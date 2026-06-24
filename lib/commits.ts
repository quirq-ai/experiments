// Data model for the commit-journey visualizer plus the deterministic mapping
// from a commit hash to the growth traits of one tree generation.

export type Commit = {
  hash: string;
  shortHash: string;
  author: string;
  date: string; // ISO 8601
  subject: string;
  additions: number;
  deletions: number;
  files: number;
};

// Traits that shape one generation of the fractal tree. Every value is a pure
// function of the commit hash, so a given commit always grows the same way.
export type CommitTraits = {
  angle: number; // half-spread between the two child branches, radians
  lengthL: number; // left child length ratio
  lengthR: number; // right child length ratio
  lean: number; // asymmetry bias applied to both children, radians
  twist: number; // small counter-rotation, radians
  hue: number; // 0..360, a base hue fingerprint for the commit
};

// Normalized 0..1 value from a pair of hex chars at `slot`, wrapping the hash.
function hexByte(hash: string, slot: number): number {
  const h = (hash || "0").toLowerCase();
  if (h.length === 0) return 0;
  const i = (slot * 2) % h.length;
  const pair = (h[i] ?? "0") + (h[(i + 1) % h.length] ?? "0");
  const value = parseInt(pair, 16);
  return Number.isNaN(value) ? 0 : value / 255;
}

export function commitTraits(hash: string): CommitTraits {
  const b0 = hexByte(hash, 0);
  const b1 = hexByte(hash, 1);
  const b2 = hexByte(hash, 2);
  const b3 = hexByte(hash, 3);
  const b4 = hexByte(hash, 4);
  const b5 = hexByte(hash, 5);

  return {
    angle: (14 + b0 * 34) * (Math.PI / 180), // 14..48 degrees
    lengthL: 0.6 + b1 * 0.18, // 0.60..0.78
    lengthR: 0.58 + b2 * 0.18, // 0.58..0.76
    lean: (b3 - 0.5) * 0.5, // -0.25..0.25 rad
    twist: (b5 - 0.5) * 0.28, // -0.14..0.14 rad
    hue: Math.floor(b4 * 360)
  };
}

export function diffMagnitude(commit: Commit): number {
  return commit.additions + commit.deletions;
}

// Stable hue for an author name, so "color by author" stays consistent.
export function authorHue(author: string): number {
  let hash = 0;
  for (let i = 0; i < author.length; i += 1) {
    hash = (hash * 31 + author.charCodeAt(i)) % 360;
  }
  return hash;
}

// Offline fallback so the canvas always has something to grow, even with no git
// access. Hashes are arbitrary hex; the messages sketch a small project arc.
export const SAMPLE_COMMITS: Commit[] = [
  { hash: "1a2f9c3e7b04d5a6e8f1029c3b4d5e6f70819aa2", shortHash: "1a2f9c3", author: "Ada Wynn", date: "2025-01-06T09:12:00Z", subject: "first commit: project scaffold", additions: 420, deletions: 0, files: 12 },
  { hash: "b73c1d2e4f5061728394a5b6c7d8e9f001122334", shortHash: "b73c1d2", author: "Ada Wynn", date: "2025-01-08T14:30:00Z", subject: "feat: canvas render loop", additions: 188, deletions: 14, files: 4 },
  { hash: "c40918aa6b5c4d3e2f1009887766554433221100", shortHash: "c40918a", author: "Milo Reyes", date: "2025-01-11T11:02:00Z", subject: "feat: pan and zoom controls", additions: 96, deletions: 22, files: 3 },
  { hash: "d5e6f7a8b9c0d1e2f3041526378495a6b7c8d9e0", shortHash: "d5e6f7a", author: "Ada Wynn", date: "2025-01-15T16:45:00Z", subject: "fix: devicePixelRatio scaling", additions: 31, deletions: 27, files: 1 },
  { hash: "e1f2039485766758493a2b1c0d9e8f7a6b5c4d3e", shortHash: "e1f2039", author: "Sora Kim", date: "2025-01-19T08:20:00Z", subject: "feat: palette system", additions: 142, deletions: 8, files: 5 },
  { hash: "f9081726354463728190a1b2c3d4e5f6071829aa", shortHash: "f908172", author: "Milo Reyes", date: "2025-01-24T13:11:00Z", subject: "perf: typed array pixel writes", additions: 64, deletions: 58, files: 2 },
  { hash: "0a1b2c3d4e5f60718293a4b5c6d7e8f9001a2b3c", shortHash: "0a1b2c3", author: "Sora Kim", date: "2025-02-01T10:05:00Z", subject: "feat: symmetry mirroring", additions: 210, deletions: 19, files: 6 },
  { hash: "12233445566778899aabbccddeeff00112233445", shortHash: "1223344", author: "Ada Wynn", date: "2025-02-09T15:48:00Z", subject: "refactor: split renderers", additions: 305, deletions: 280, files: 9 },
  { hash: "9988776655443322110ffeeddccbbaa998877665", shortHash: "9988776", author: "Milo Reyes", date: "2025-02-15T09:33:00Z", subject: "feat: export to png", additions: 47, deletions: 6, files: 2 },
  { hash: "abcdef0123456789abcdef0123456789abcdef01", shortHash: "abcdef0", author: "Sora Kim", date: "2025-02-22T17:27:00Z", subject: "feat: animated growth mode", additions: 176, deletions: 33, files: 4 },
  { hash: "0f1e2d3c4b5a69788796a5b4c3d2e1f009182736", shortHash: "0f1e2d3", author: "Ada Wynn", date: "2025-03-02T12:14:00Z", subject: "fix: orbit overflow guard", additions: 22, deletions: 18, files: 1 },
  { hash: "5a6b7c8d9e0f102132435465768798a9bacbdcec", shortHash: "5a6b7c8", author: "Milo Reyes", date: "2025-03-10T14:52:00Z", subject: "feat: quadrant visibility index", additions: 134, deletions: 11, files: 3 },
  { hash: "73829100aabbccddeeff112233445566778899aa", shortHash: "7382910", author: "Sora Kim", date: "2025-03-18T08:41:00Z", subject: "chore: dependency bump", additions: 9, deletions: 9, files: 2 },
  { hash: "deadbeef00112233445566778899aabbccddeeff", shortHash: "deadbee", author: "Ada Wynn", date: "2025-03-27T16:09:00Z", subject: "feat: data-driven journey page", additions: 388, deletions: 24, files: 7 },
  { hash: "cafef00d1122334455667788990aabbccddeeff0", shortHash: "cafef00", author: "Milo Reyes", date: "2025-04-04T11:58:00Z", subject: "polish: motion + reduced-motion", additions: 73, deletions: 41, files: 3 },
  { hash: "246802468ace13579bdf02468ace13579bdf0246", shortHash: "2468024", author: "Sora Kim", date: "2025-04-13T13:22:00Z", subject: "docs: write the readme", additions: 120, deletions: 2, files: 1 }
];
