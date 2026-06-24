import type { Metadata } from "next";

import { CommitGrowth } from "@/components/CommitGrowth";

export const metadata: Metadata = {
  title: "Commit Journey - Fractal Lab",
  description:
    "Grow a unique fractal tree from a repository's real commit history. Each commit hash seeds a generation; the journey is the growth."
};

export default function JourneyPage() {
  return <CommitGrowth />;
}
