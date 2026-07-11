export type ImpactScore = 1 | 2 | 3 | 4 | 5;

export type ConfidenceLevel = "high" | "medium" | "low";

export interface SourceReference {
  label: string;
  url: string;
  title?: string;
  publisher?: string;
  year?: number;
  note?: string;
}

export interface TechnologyNode {
  id: string;
  title: string;
  year: number;
  yearLabel: string;
  era: string;
  domain: string;
  summary: string;
  description: string;
  location: string;
  people: string[];
  tags: string[];
  impact: ImpactScore;
  confidence: ConfidenceLevel;
  sources: SourceReference[];
}

export interface TechnologyEdge {
  source: string;
  target: string;
  type: string;
  label: string;
  description: string;
}

export const VIEW_IDS = [
  "graph",
  "timeline",
  "map",
  "paths",
  "matrix",
  "stories",
  "compare",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];
