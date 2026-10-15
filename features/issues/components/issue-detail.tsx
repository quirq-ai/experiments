"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Ellipsis, ExternalLink, SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { PanelHeader } from "@/components/shell/panel-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  AssigneePicker,
  DueDatePicker,
  EstimatePicker,
  LabelPicker,
  ObjectivePicker,
  PriorityPicker,
  SprintPicker,
  StatusPicker,
} from "@/features/issues/components/pickers";
import { formatDate, spacewalkSessionUrl } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import type { Issue, IssueOrigin } from "@/lib/types";

/*
  Issue detail view for /issue/[key]. Left: editable title, description,
  activity. Right: property sidebar; every change writes to the store.
*/
export function IssueDetail({ issueKey }: { issueKey: string }) {
  const issues = useAppStore((s) => s.issues);
  const number = Number(issueKey.split("-")[1]);
  const issue = issues.find((i) => i.number === number);

  if (!issue) {
    return (
      <>
        <PanelHeader left={<span>Issue</span>} />
        <EmptyState
          icon={SearchX}
          title="Issue not found"
          description="It may have been deleted, or the link is out of date."
          action={
            <Button variant="outline" size="xs" asChild>
              <Link href="/issues">Back to issues</Link>
            </Button>
          }
        />
      </>
    );
  }

  return <IssueDetailBody issue={issue} />;
}

function IssueDetailBody({ issue }: { issue: Issue }) {
  const router = useRouter();
  const teamKey = useAppStore((s) => s.workspace.teamKey);
  const teamName = useAppStore((s) => s.workspace.teamName);
  const members = useAppStore((s) => s.members);
  const updateIssue = useAppStore((s) => s.updateIssue);
  const deleteIssue = useAppStore((s) => s.deleteIssue);

  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");

  // Re-sync local drafts during render whenever the store issue changes.
  const [synced, setSynced] = useState({
    id: issue.id,
    title: issue.title,
    description: issue.description ?? "",
  });
  if (
    synced.id !== issue.id ||
    synced.title !== issue.title ||
    synced.description !== (issue.description ?? "")
  ) {
    setSynced({ id: issue.id, title: issue.title, description: issue.description ?? "" });
    setTitle(issue.title);
    setDescription(issue.description ?? "");
  }

  const assignee = members.find((m) => m.id === issue.assigneeId) ?? null;

  const commitTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(issue.title);
      return;
    }
    if (trimmed !== issue.title) updateIssue(issue.id, { title: trimmed });
  };

  const commitDescription = () => {
    if (description !== (issue.description ?? "")) {
      updateIssue(issue.id, { description });
    }
  };

  return (
    <>
      <PanelHeader
        left={
          <>
            <span className="flex size-4 shrink-0 items-center justify-center rounded bg-primary text-[8.5px] font-bold text-white">
              {teamName[0]}
            </span>
            <span className="text-sm font-medium">
              {teamKey}-{issue.number}
            </span>
          </>
        }
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Issue actions">
                <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.8} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  deleteIssue(issue.id);
                  router.push("/issues");
                }}
              >
                Delete issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-2xl">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Issue title"
              className="w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              placeholder="Add description..."
              className="mt-3 min-h-24 w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />

            <Separator className="my-6" />

            <div className="text-xs font-medium text-faint">Activity</div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              {assignee ? <MemberAvatar member={assignee} size="sm" /> : null}
              <span>Created {formatDate(issue.createdAt)}</span>
            </div>
          </div>
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto border-l px-4 py-4">
          <div className="text-2xs font-medium text-faint">Properties</div>
          <div className="mt-3 flex flex-col items-start gap-3">
            <PropertyRow label="Status">
              <StatusPicker
                value={issue.status}
                onChange={(v) => updateIssue(issue.id, { status: v })}
              />
            </PropertyRow>
            <PropertyRow label="Priority">
              <PriorityPicker
                value={issue.priority}
                onChange={(v) => updateIssue(issue.id, { priority: v })}
              />
            </PropertyRow>
            <PropertyRow label="Assignee">
              <AssigneePicker
                value={issue.assigneeId}
                onChange={(v) => updateIssue(issue.id, { assigneeId: v })}
              />
            </PropertyRow>
            <PropertyRow label="Labels">
              <LabelPicker
                value={issue.labelIds}
                onChange={(v) => updateIssue(issue.id, { labelIds: v })}
              />
            </PropertyRow>
            <PropertyRow label="Estimate">
              <EstimatePicker
                value={issue.estimate}
                onChange={(v) => updateIssue(issue.id, { estimate: v })}
              />
            </PropertyRow>
            <PropertyRow label="Sprint">
              <SprintPicker
                value={issue.sprintId}
                onChange={(v) => updateIssue(issue.id, { sprintId: v })}
              />
            </PropertyRow>
            <PropertyRow label="OKR">
              <ObjectivePicker
                value={issue.objectiveId}
                onChange={(v) => updateIssue(issue.id, { objectiveId: v })}
              />
            </PropertyRow>
            <PropertyRow label="Due date">
              <DueDatePicker
                value={issue.dueDate}
                onChange={(v) => updateIssue(issue.id, { dueDate: v })}
              />
            </PropertyRow>
          </div>
          {issue.origin ? <OriginSection origin={issue.origin} /> : null}
        </aside>
      </div>
    </>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/*
  Where a mirrored issue came from on disk, plus the first Space
  convergence seam: agent todos deep link into space-walk (Walk) so the
  session that produced the work can be replayed from the issue.
*/
function OriginSection({ origin }: { origin: IssueOrigin }) {
  const fileName = origin.sourcePath.split("/").pop() ?? origin.sourcePath;
  return (
    <div className="mt-6">
      <div className="text-2xs font-medium text-faint">Origin</div>
      <div className="mt-3 flex flex-col items-start gap-3">
        <PropertyRow label="Kind">
          <span className="text-sm">
            {origin.kind === "agent_todo" ? "Agent todo" : "Work item"}
          </span>
        </PropertyRow>
        {origin.sessionId ? (
          <PropertyRow label="Session">
            <CopyValue value={origin.sessionId} display={origin.sessionId} />
          </PropertyRow>
        ) : null}
        <PropertyRow label="Source">
          <CopyValue value={origin.sourcePath} display={fileName} />
        </PropertyRow>
        {origin.sessionId ? (
          <Button variant="outline" size="xs" asChild>
            <a
              href={spacewalkSessionUrl(origin.sessionId)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4 text-muted-foreground" strokeWidth={1.8} />
              Watch replay
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CopyValue({ value, display }: { value: string; display: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  const Icon = copied ? Check : Copy;
  return (
    <div className="flex w-full items-center gap-1">
      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={value}>
        {display}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Copy ${value}`}
        onClick={copy}
      >
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
      </Button>
    </div>
  );
}
