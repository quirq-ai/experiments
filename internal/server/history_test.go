package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xo-labs/spacewalk/internal/model"
)

// requireGit skips tests that shell out to a real git binary.
func requireGit(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
}

// gitHistoryRepo builds a throwaway repo with two commits: the first adds
// a.go and doomed.txt under a subject containing a pipe (the framing must not
// care), the second grows a.go and deletes doomed.txt — the deleted path has
// to stay a target so the map can ghost it.
func gitHistoryRepo(t *testing.T) string {
	t.Helper()
	requireGit(t)
	repo := t.TempDir()
	gitHistoryRun(t, repo, "init", "-q")
	gitHistoryRun(t, repo, "config", "user.name", "Test Author")
	gitHistoryRun(t, repo, "config", "user.email", "test@example.com")
	writeHistoryFile(t, repo, "a.go", "package demo\n")
	writeHistoryFile(t, repo, "doomed.txt", "gone soon\nvery soon\n")
	gitHistoryRun(t, repo, "add", ".")
	gitHistoryRun(t, repo, "commit", "-q", "-m", "add a | doomed")
	writeHistoryFile(t, repo, "a.go", "package demo\n\nfunc A() {}\n")
	gitHistoryRun(t, repo, "rm", "-q", "doomed.txt")
	gitHistoryRun(t, repo, "add", ".")
	gitHistoryRun(t, repo, "commit", "-q", "-m", "grow a, drop doomed")
	return repo
}

func gitHistoryRun(t *testing.T, repo string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", repo}, args...)...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func writeHistoryFile(t *testing.T, repo, rel, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(repo, rel), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func getRepoHistory(t *testing.T, s *Server, repo string) (*httptest.ResponseRecorder, *model.Trace) {
	t.Helper()
	resp := httptest.NewRecorder()
	s.handleRepoHistory(resp, httptest.NewRequest(http.MethodGet, "/api/repomap/history?repo="+url.QueryEscape(repo), nil))
	if resp.Code != http.StatusOK {
		return resp, nil
	}
	var trace model.Trace
	if err := json.Unmarshal(resp.Body.Bytes(), &trace); err != nil {
		t.Fatalf("history unmarshal: %v\n%s", err, resp.Body.String())
	}
	return resp, &trace
}

func TestRepoHistorySynthesizesTrace(t *testing.T) {
	repo := gitHistoryRepo(t)
	s := New(Config{})
	resp, trace := getRepoHistory(t, s, repo)
	if trace == nil {
		t.Fatalf("history status = %d body=%s", resp.Code, resp.Body.String())
	}

	if trace.Version != 1 {
		t.Fatalf("version = %d, want 1", trace.Version)
	}
	dirname := filepath.Base(repo)
	if trace.Session.Harness != "git" || trace.Session.ID != "git-"+dirname {
		t.Fatalf("session = %#v", trace.Session)
	}
	if trace.Session.Title != dirname+" · git history" {
		t.Fatalf("title = %q", trace.Session.Title)
	}
	if trace.Session.Cwd != repo || trace.Session.EventCount != 2 {
		t.Fatalf("session = %#v", trace.Session)
	}
	if len(trace.Events) != 2 || len(trace.Marks) != 0 {
		t.Fatalf("events = %d marks = %d", len(trace.Events), len(trace.Marks))
	}
	if trace.Session.StartedAt != trace.Events[0].Timestamp || trace.Session.EndedAt != trace.Events[1].Timestamp {
		t.Fatalf("session times %q..%q, events %q..%q",
			trace.Session.StartedAt, trace.Session.EndedAt, trace.Events[0].Timestamp, trace.Events[1].Timestamp)
	}

	for i, event := range trace.Events {
		if event.Seq != i {
			t.Fatalf("event %d seq = %d, want chronological", i, event.Seq)
		}
		if event.Action != "edit" || event.IsError || !event.OutcomeKnown {
			t.Fatalf("event %d = %#v", i, event)
		}
		short, ok := strings.CutPrefix(event.Tool, "commit ")
		if !ok || len(short) != 7 {
			t.Fatalf("event %d tool = %q", i, event.Tool)
		}
		for _, target := range event.Targets {
			if target.Touch != "edit" {
				t.Fatalf("event %d target = %#v", i, target)
			}
		}
	}

	// First commit: a.go (+1) and doomed.txt (+2); the pipe in the subject
	// must survive the framing.
	first := trace.Events[0]
	if !strings.Contains(first.Summary, "add a | doomed") || !strings.HasSuffix(first.Summary, "— Test Author · +3 −0") {
		t.Fatalf("first summary = %q", first.Summary)
	}
	if first.ResultBytes != 3 || len(first.Targets) != 2 {
		t.Fatalf("first event = %#v", first)
	}

	// Second commit: a.go +2, doomed.txt deleted (−2). The churn proxy sums
	// insertions and deletions, and the deleted path stays a target.
	second := trace.Events[1]
	if second.ResultBytes != 4 || !strings.HasSuffix(second.Summary, "· +2 −2") {
		t.Fatalf("second event summary = %q resultBytes = %d", second.Summary, second.ResultBytes)
	}
	paths := map[string]bool{}
	for _, target := range second.Targets {
		paths[target.Path] = true
	}
	if !paths["a.go"] || !paths["doomed.txt"] {
		t.Fatalf("second targets = %#v", second.Targets)
	}
	if trace.Events[0].Timestamp > trace.Events[1].Timestamp {
		t.Fatalf("timestamps not chronological: %q > %q", trace.Events[0].Timestamp, trace.Events[1].Timestamp)
	}
}

func TestRepoHistoryCapKeepsNewestCommits(t *testing.T) {
	repo := gitHistoryRepo(t)
	oldCap := maxHistoryCommits
	maxHistoryCommits = 1
	defer func() { maxHistoryCommits = oldCap }()

	resp, trace := getRepoHistory(t, New(Config{}), repo)
	if trace == nil {
		t.Fatalf("history status = %d body=%s", resp.Code, resp.Body.String())
	}
	if len(trace.Events) != 1 {
		t.Fatalf("events = %d, want 1", len(trace.Events))
	}
	// The cap drops the OLD end: the surviving commit is the newest.
	if !strings.Contains(trace.Events[0].Summary, "grow a, drop doomed") {
		t.Fatalf("surviving summary = %q", trace.Events[0].Summary)
	}
	if !strings.HasSuffix(trace.Session.Title, " · git history · last 1 commits") {
		t.Fatalf("title = %q", trace.Session.Title)
	}
}

func TestRepoHistoryEmptyRepoServesEmptyTrace(t *testing.T) {
	requireGit(t)
	repo := t.TempDir()
	gitHistoryRun(t, repo, "init", "-q")

	resp, trace := getRepoHistory(t, New(Config{}), repo)
	if trace == nil {
		t.Fatalf("history status = %d body=%s", resp.Code, resp.Body.String())
	}
	if len(trace.Events) != 0 || trace.Session.EventCount != 0 || trace.Session.Harness != "git" {
		t.Fatalf("trace = %#v", trace)
	}
}

func TestRepoCommitReturnsFilesAndPatch(t *testing.T) {
	repo := gitHistoryRepo(t)
	s := New(Config{})
	_, trace := getRepoHistory(t, s, repo)
	if trace == nil || len(trace.Events) != 2 {
		t.Fatalf("trace = %#v", trace)
	}
	short := strings.TrimPrefix(trace.Events[1].Tool, "commit ")

	resp := httptest.NewRecorder()
	s.handleRepoCommit(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/commit?repo="+url.QueryEscape(repo)+"&hash="+short, nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("commit status = %d body=%s", resp.Code, resp.Body.String())
	}
	var detail repoCommitDetail
	if err := json.Unmarshal(resp.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if len(detail.Hash) != 40 || !strings.HasPrefix(detail.Hash, short) {
		t.Fatalf("hash = %q, want full hash for %q", detail.Hash, short)
	}
	if detail.Author != "Test Author" || detail.Subject != "grow a, drop doomed" || detail.Ts == "" {
		t.Fatalf("detail = %#v", detail)
	}
	files := map[string][2]int{}
	for _, file := range detail.Files {
		files[file.Path] = [2]int{file.Insertions, file.Deletions}
	}
	if files["a.go"] != [2]int{2, 0} || files["doomed.txt"] != [2]int{0, 2} {
		t.Fatalf("files = %#v", detail.Files)
	}
	if !strings.Contains(detail.Patch, "diff --git") || !strings.Contains(detail.Patch, "-gone soon") {
		t.Fatalf("patch = %q", detail.Patch)
	}
	if strings.Contains(detail.Patch, patchTruncatedMarker) {
		t.Fatalf("small patch reported truncated: %q", detail.Patch)
	}
}

func TestRepoCommitTruncatesPatch(t *testing.T) {
	repo := gitHistoryRepo(t)
	oldCap := maxPatchBytes
	maxPatchBytes = 48
	defer func() { maxPatchBytes = oldCap }()

	s := New(Config{})
	_, trace := getRepoHistory(t, s, repo)
	if trace == nil {
		t.Fatal("history unavailable")
	}
	short := strings.TrimPrefix(trace.Events[0].Tool, "commit ")

	resp := httptest.NewRecorder()
	s.handleRepoCommit(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/commit?repo="+url.QueryEscape(repo)+"&hash="+short, nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("commit status = %d body=%s", resp.Code, resp.Body.String())
	}
	var detail repoCommitDetail
	if err := json.Unmarshal(resp.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(detail.Patch, patchTruncatedMarker) {
		t.Fatalf("patch = %q, want truncation marker", detail.Patch)
	}
	if len(detail.Patch) > maxPatchBytes+len(patchTruncatedMarker) {
		t.Fatalf("patch length = %d, want <= %d", len(detail.Patch), maxPatchBytes+len(patchTruncatedMarker))
	}
}

func TestRepoHistoryRejections(t *testing.T) {
	requireGit(t)

	// No ?repo= and no configured RepoRoot: same 404 as handleRepoMap.
	resp := httptest.NewRecorder()
	New(Config{}).handleRepoHistory(resp, httptest.NewRequest(http.MethodGet, "/api/repomap/history", nil))
	if resp.Code != http.StatusNotFound {
		t.Fatalf("no-repo status = %d, want 404", resp.Code)
	}

	// A path that is not a directory is rejected before any subprocess runs.
	resp = httptest.NewRecorder()
	New(Config{}).handleRepoHistory(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/history?repo="+url.QueryEscape(filepath.Join(t.TempDir(), "missing")), nil))
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("invalid-path status = %d, want 400", resp.Code)
	}

	// A real directory without git history.
	resp = httptest.NewRecorder()
	New(Config{}).handleRepoHistory(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/history?repo="+url.QueryEscape(t.TempDir()), nil))
	if resp.Code != http.StatusNotFound || !strings.Contains(resp.Body.String(), "not a git repo") {
		t.Fatalf("non-git status = %d body=%q", resp.Code, resp.Body.String())
	}
}

func TestRepoCommitRejections(t *testing.T) {
	repo := gitHistoryRepo(t)
	s := New(Config{})

	// No repo resolvable.
	resp := httptest.NewRecorder()
	New(Config{}).handleRepoCommit(resp, httptest.NewRequest(http.MethodGet, "/api/repomap/commit?hash=aaaaaaa", nil))
	if resp.Code != http.StatusNotFound {
		t.Fatalf("no-repo status = %d, want 404", resp.Code)
	}

	// A path that is not a directory.
	resp = httptest.NewRecorder()
	s.handleRepoCommit(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/commit?repo="+url.QueryEscape(filepath.Join(t.TempDir(), "missing"))+"&hash=aaaaaaa", nil))
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("invalid-path status = %d, want 400", resp.Code)
	}

	// Hashes that are not plain hex never reach a git argument.
	for _, hash := range []string{"", "abc", "zzzzzzz", "aaaaaaa;rm", "HEAD", strings.Repeat("a", 41)} {
		resp = httptest.NewRecorder()
		s.handleRepoCommit(resp, httptest.NewRequest(http.MethodGet,
			"/api/repomap/commit?repo="+url.QueryEscape(repo)+"&hash="+url.QueryEscape(hash), nil))
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("hash %q status = %d, want 400", hash, resp.Code)
		}
	}

	// A well-formed hash that names no commit.
	resp = httptest.NewRecorder()
	s.handleRepoCommit(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/commit?repo="+url.QueryEscape(repo)+"&hash="+strings.Repeat("a", 40), nil))
	if resp.Code != http.StatusNotFound {
		t.Fatalf("unknown-hash status = %d, want 404", resp.Code)
	}

	// A directory without git history.
	resp = httptest.NewRecorder()
	s.handleRepoCommit(resp, httptest.NewRequest(http.MethodGet,
		"/api/repomap/commit?repo="+url.QueryEscape(t.TempDir())+"&hash=aaaaaaa", nil))
	if resp.Code != http.StatusNotFound || !strings.Contains(resp.Body.String(), "not a git repo") {
		t.Fatalf("non-git status = %d body=%q", resp.Code, resp.Body.String())
	}
}
