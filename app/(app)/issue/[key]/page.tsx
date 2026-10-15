"use client";

import { use } from "react";
import { IssueDetail } from "@/features/issues/components/issue-detail";

export default function IssuePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  return <IssueDetail issueKey={key} />;
}
