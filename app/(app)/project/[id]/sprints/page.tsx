"use client";

import { use } from "react";
import { ProjectView } from "@/features/projects/components/project-view";

export default function ProjectSprintsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProjectView projectId={id} view="sprints" />;
}
