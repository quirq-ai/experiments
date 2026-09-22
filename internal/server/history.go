package server

// Git history playback: a repo's commit log IS a trace. /api/repomap/history
// synthesizes a model.Trace from git log — one event per commit, targets per
// touched file — so the map view can replay a repo's history through the
// ordinary playback stack. /api/repomap/commit serves one commit's numstat
// rows and patch text for the detail cards. Both endpoints resolve the repo
// the way handleRepoMap does and shell out to git under the same bounded
// discipline as internal/citymap's builder (replicated here — the server
// must not depend on citymap internals).

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/xo-labs/spacewalk/internal/model"
)

// Subprocess limits, mirroring the citymap builder's git discipline.
// Package-level vars so tests can shrink them; production code treats them
// as constants.
var (
	// gitHistoryTimeout bounds every git subprocess these handlers spawn —
	// no git call may hang a request. Same rationale as citymap's gitTimeout.
	gitHistoryTimeout = 30 * time.Second
	// maxHistoryCommits caps how many commits the synthesized trace holds.
	// The cap drops the OLD end: git applies -n to the newest-first walk
	// before --reverse flips it chronological, so the newest commits stay.
	maxHistoryCommits = 2000
	// maxHistoryBytes bounds the streamed git log read the way
	// maxGitListPaths bounds ls-files — a pathological repo cannot buffer
	// gigabytes of numstat into memory.
	maxHistoryBytes = int64(16 << 20)
	// maxPatchBytes caps the patch text /api/repomap/commit returns; the
	// detail card shows a scrollable excerpt, not the whole diff.
	maxPatchBytes = 64 * 1024
)

// patchTruncatedMarker is appended verbatim when the patch hit maxPatchBytes;
// the card renders it as-is.
const patchTruncatedMarker = "\n… truncated"

// Log framing uses control characters, not printable delimiters: commit
// subjects may contain anything printable (pipes included), but never RS/US.
const (
	gitRecordSep = "\x1e"
	gitFieldSep  = "\x1f"
	gitLogFormat = gitRecordSep + "%H" + gitFieldSep + "%an" + gitFieldSep + "%aI" + gitFieldSep + "%s"
)

// commitHashPattern is the only shape a ?hash= may take before it reaches a
// git argument: 7-to-40 hex characters, nothing else.
var commitHashPattern = regexp.MustCompile(`^[0-9a-fA-F]{7,40}$`)

// gitCommit is one parsed record of the framed log stream.
type gitCommit struct {
	hash    string
	author  string
	ts      string
	subject string
	files   []gitCommitFile
}

type gitCommitFile struct {
	path       string
	insertions int
	deletions  int
}

// repoCommitDetail is the /api/repomap/commit response shape.
type repoCommitDetail struct {
	Hash    string           `json:"hash"`
	Author  string           `json:"author"`
	Ts      string           `json:"ts"`
	Subject string           `json:"subject"`
	Files   []repoCommitFile `json:"files"`
	Patch   string           `json:"patch"`
}

type repoCommitFile struct {
	Path       string `json:"path"`
	Insertions int    `json:"insertions"`
	Deletions  int    `json:"deletions"`
}

// handleRepoHistory serves the repo's git history as a synthesized trace: the
// existing playback stack replays it unchanged, and deleted files land as
// targets absent from the citymap — the ghost path already handles them.
func (s *Server) handleRepoHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	repo, ok := s.resolveRepoParam(w, r)
	if !ok {
		return
	}
	if !isGitWorkTree(repo) {
		http.Error(w, "not a git repo", http.StatusNotFound)
		return
	}
	trace, err := synthesizeGitTrace(repo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, trace)
}

// handleRepoCommit serves one commit's per-file numstat and its patch,
// truncated to maxPatchBytes, for the detail card's lazy diff section. Small
// and on demand — no cache.
func (s *Server) handleRepoCommit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	repo, ok := s.resolveRepoParam(w, r)
	if !ok {
		return
	}
	hash := r.URL.Query().Get("hash")
	if !commitHashPattern.MatchString(hash) {
		http.Error(w, "invalid commit hash", http.StatusBadRequest)
		return
	}
	if !isGitWorkTree(repo) {
		http.Error(w, "not a git repo", http.StatusNotFound)
		return
	}
	// Trailing "--" pins the validated hash as a revision, never a path.
	metaOut, metaCut, err := gitHistoryBounded(repo, maxHistoryBytes,
		"-c", "core.quotepath=false",
		"show", "--no-renames", "--numstat", "--format="+gitLogFormat, hash, "--")
	if err != nil {
		http.Error(w, "commit not found", http.StatusNotFound)
		return
	}
	commits := parseGitLog(string(metaOut))
	if len(commits) != 1 {
		http.Error(w, "commit not found", http.StatusNotFound)
		return
	}
	commit := commits[0]
	if metaCut && len(commit.files) > 0 {
		// the byte cap may have split the trailing numstat row mid-path
		commit.files = commit.files[:len(commit.files)-1]
	}
	patchOut, patchCut, err := gitHistoryBounded(repo, int64(maxPatchBytes),
		"show", "--no-color", "--format=", hash, "--")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if patchCut {
		patchOut = trimPartialRune(patchOut)
	}
	patch := string(patchOut)
	if patchCut {
		patch += patchTruncatedMarker
	}
	files := make([]repoCommitFile, 0, len(commit.files))
	for _, file := range commit.files {
		files = append(files, repoCommitFile{Path: file.path, Insertions: file.insertions, Deletions: file.deletions})
	}
	writeJSON(w, repoCommitDetail{
		Hash:    commit.hash,
		Author:  commit.author,
		Ts:      commit.ts,
		Subject: commit.subject,
		Files:   files,
		Patch:   patch,
	})
}

// resolveRepoParam resolves the repo the way handleRepoMap does — ?repo=
// query param, RepoRoot fallback, 404 when neither — and adds the existence
// check the git endpoints need before shelling out: a path that is not a
// directory is a 400, not a subprocess run. On failure the response has
// already been written.
func (s *Server) resolveRepoParam(w http.ResponseWriter, r *http.Request) (string, bool) {
	repo := r.URL.Query().Get("repo")
	if repo == "" {
		repo = s.cfg.RepoRoot
	}
	if repo == "" {
		http.Error(w, "no repo configured", http.StatusNotFound)
		return "", false
	}
	abs, err := filepath.Abs(repo)
	if err != nil {
		http.Error(w, "invalid repo path", http.StatusBadRequest)
		return "", false
	}
	if info, err := os.Stat(abs); err != nil || !info.IsDir() {
		http.Error(w, "invalid repo path", http.StatusBadRequest)
		return "", false
	}
	return abs, true
}

// synthesizeGitTrace turns the repo's commit log into a trace: session
// harness "git", one edit event per commit in chronological order.
func synthesizeGitTrace(repo string) (*model.Trace, error) {
	dirname := filepath.Base(repo)
	trace := &model.Trace{
		Version: 1,
		Session: model.TraceSession{
			ID:      "git-" + dirname,
			Harness: "git",
			Title:   dirname + " · git history",
			Cwd:     repo,
		},
		Events: []model.Event{},
		Marks:  []model.Mark{},
	}
	// A work tree with no commits yet has no history to play; an empty trace
	// keeps the map static without pretending the repo is not git.
	if _, err := gitHistoryOutput(repo, "rev-parse", "HEAD"); err != nil {
		trace.Stats = model.ComputeStats(trace, 0, model.ObservabilityExact)
		return trace, nil
	}
	// One commit past the cap makes a capped history detectable without a
	// second subprocess: git applies -n to the newest-first walk before
	// --reverse flips it chronological, so the overflow record is the oldest.
	// core.quotepath=false keeps non-ASCII paths literal instead of C-quoted.
	out, cut, err := gitHistoryBounded(repo, maxHistoryBytes,
		"-c", "core.quotepath=false",
		"log", "--reverse", "--no-renames", "--numstat",
		"-n", strconv.Itoa(maxHistoryCommits+1),
		"--format="+gitLogFormat)
	if err != nil {
		return nil, err
	}
	commits := parseGitLog(string(out))
	if cut && len(commits) > 0 {
		// safety valve, not the normal path: the byte cap lands mid-stream,
		// so the trailing record may be partial — drop it
		commits = commits[:len(commits)-1]
	}
	if len(commits) > maxHistoryCommits {
		commits = commits[len(commits)-maxHistoryCommits:]
		trace.Session.Title += fmt.Sprintf(" · last %d commits", maxHistoryCommits)
	}

	events := make([]model.Event, 0, len(commits))
	for i, commit := range commits {
		insertions, deletions := 0, 0
		targets := make([]model.Target, 0, len(commit.files))
		for _, file := range commit.files {
			insertions += file.insertions
			deletions += file.deletions
			targets = append(targets, model.Target{Path: file.path, Touch: "edit"})
		}
		events = append(events, model.Event{
			Seq:       i,
			Timestamp: commit.ts,
			Tool:      "commit " + shortCommitHash(commit.hash),
			Action:    "edit",
			Targets:   targets,
			// ResultBytes carries total insertions+deletions — the churn
			// proxy the trail-arc magnitude falls back to.
			ResultBytes:  insertions + deletions,
			IsError:      false,
			OutcomeKnown: true,
			Summary:      fmt.Sprintf("%s — %s · +%d −%d", commit.subject, commit.author, insertions, deletions),
		})
	}
	trace.Events = events
	trace.Session.EventCount = len(events)
	if len(events) > 0 {
		trace.Session.StartedAt = events[0].Timestamp
		trace.Session.EndedAt = events[len(events)-1].Timestamp
	}
	// Commits record their outcome structurally, so the error signal is exact.
	// FilesInRepo stays 0 here: the map view pairs this trace with the repo
	// citymap, which owns the file census.
	trace.Stats = model.ComputeStats(trace, 0, model.ObservabilityExact)
	return trace, nil
}

// parseGitLog splits the control-char-framed stream into commits. Each record
// is a header line — hash, author, author ISO date, subject, joined by US —
// followed by that commit's numstat rows; merge commits carry no rows.
func parseGitLog(out string) []gitCommit {
	var commits []gitCommit
	for _, record := range strings.Split(out, gitRecordSep) {
		if strings.TrimSpace(record) == "" {
			continue
		}
		lines := strings.Split(record, "\n")
		header := strings.SplitN(lines[0], gitFieldSep, 4)
		if len(header) != 4 {
			continue
		}
		commit := gitCommit{hash: header[0], author: header[1], ts: header[2], subject: header[3]}
		for _, line := range lines[1:] {
			if file, ok := parseNumstatRow(line); ok {
				commit.files = append(commit.files, file)
			}
		}
		commits = append(commits, commit)
	}
	return commits
}

// parseNumstatRow parses one "insertions\tdeletions\tpath" row. Binary files
// report "-\t-" and count as zero churn; the target is kept — a deleted
// binary still deserves its ghost.
func parseNumstatRow(line string) (gitCommitFile, bool) {
	parts := strings.SplitN(line, "\t", 3)
	if len(parts) != 3 || parts[2] == "" {
		return gitCommitFile{}, false
	}
	insertions, _ := strconv.Atoi(parts[0])
	deletions, _ := strconv.Atoi(parts[1])
	return gitCommitFile{path: filepath.ToSlash(parts[2]), insertions: insertions, deletions: deletions}, true
}

func shortCommitHash(hash string) string {
	if len(hash) > 7 {
		return hash[:7]
	}
	return hash
}

// isGitWorkTree reports whether the directory sits inside a git work tree —
// the probe behind the endpoints' 404 "not a git repo".
func isGitWorkTree(repo string) bool {
	out, err := gitHistoryOutput(repo, "rev-parse", "--is-inside-work-tree")
	return err == nil && strings.TrimSpace(string(out)) == "true"
}

// gitHistoryOutput runs one small git subcommand against repo under the
// shared deadline — no git call may hang a request. WaitDelay forces the
// pipes shut if a grandchild survives the kill and holds them open. Same
// pattern as citymap's gitOutput.
func gitHistoryOutput(repo string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), gitHistoryTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", repo}, args...)...)
	cmd.WaitDelay = time.Second
	return cmd.Output()
}

// gitHistoryBounded runs one git subcommand under the shared deadline and
// stops reading stdout at maxBytes, killing the child instead of buffering an
// unbounded diff — the same discipline citymap's gitListFiles applies to
// ls-files. The bool reports whether the cap cut the output short.
func gitHistoryBounded(repo string, maxBytes int64, args ...string) ([]byte, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), gitHistoryTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", repo}, args...)...)
	cmd.WaitDelay = time.Second
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, false, err
	}
	if err := cmd.Start(); err != nil {
		return nil, false, err
	}
	out, readErr := io.ReadAll(io.LimitReader(stdout, maxBytes+1))
	if int64(len(out)) > maxBytes {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return out[:maxBytes], true, nil
	}
	if readErr != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return nil, false, readErr
	}
	if err := cmd.Wait(); err != nil {
		if msg := strings.TrimSpace(stderr.String()); msg != "" {
			return nil, false, fmt.Errorf("git %s: %s", args[0], msg)
		}
		return nil, false, err
	}
	return out, false, nil
}

// trimPartialRune drops the dangling continuation bytes of a rune the byte
// cap split, so a truncated patch never ends in mojibake right before the
// truncation marker. At most three bytes can dangle.
func trimPartialRune(b []byte) []byte {
	for i := 0; i < 3 && len(b) > 0; i++ {
		if r, size := utf8.DecodeLastRune(b); r != utf8.RuneError || size > 1 {
			return b
		}
		b = b[:len(b)-1]
	}
	return b
}
