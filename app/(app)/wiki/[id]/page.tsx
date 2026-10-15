"use client";

import { use } from "react";
import { WikiDocPage } from "@/features/wiki/components/wiki-doc";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <WikiDocPage id={id} />;
}
