"use client";

import { use } from "react";
import { SprintDetail } from "@/features/sprints/components/sprint-detail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SprintDetail id={id} />;
}
