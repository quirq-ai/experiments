"use client";

import { useEffect, useState } from "react";
import { sessionId } from "@/components/activity/trail";
import { PathTools } from "./path-tools";

// The tab's own history file, a row under History in the generated data. Only the
// browser knows which tab this is, so the row is drawn here, after the page loads.

export function ThisTabRow({ historyDir, className }: { historyDir: string; className: string }) {
  const [session, setSession] = useState<string | null>(null);
  useEffect(() => setSession(sessionId()), []);
  if (!session) return null;
  const path = `${historyDir.replace(/\/$/, "")}/${session}/innernet.jsonl`;
  return (
    <li className={className}>
      <span className="pl-4 text-[13.5px] text-ink-2">This tab</span>
      <span className="order-3 col-span-2 min-w-0 truncate pl-4 font-mono text-[12.5px] text-muted sm:order-none sm:col-span-1 sm:pl-0" title={path}>
        …/{session}/innernet.jsonl
      </span>
      <span className="hidden whitespace-nowrap text-right text-[12.5px] text-muted sm:block">edit it, then reload</span>
      <span className="flex justify-end">
        <PathTools id="session" label="this tab's history file" path={path} editable />
      </span>
    </li>
  );
}
