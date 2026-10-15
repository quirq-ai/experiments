"use client";

import { use } from "react";
import { OkrDetail } from "@/features/okrs/components/okr-detail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OkrDetail id={id} />;
}
