"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Ellipsis, PencilLine } from "lucide-react";
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
import { formatDate } from "@/lib/helpers";
import { useAppStore } from "@/lib/store";
import type { WikiDoc } from "@/lib/types";
import { DocMarkdown } from "./doc-markdown";

export function WikiDocPage({ id }: { id: string }) {
  const wikiDocs = useAppStore((s) => s.wikiDocs);
  const doc = wikiDocs.find((d) => d.id === id);

  if (!doc) {
    return (
      <>
        <PanelHeader left={<span>Wiki</span>} />
        <EmptyState
          icon={BookOpen}
          title="Doc not found"
          description="It may have been deleted."
          action={
            <Button size="xs" variant="outline" asChild>
              <Link href="/wiki">Back to wiki</Link>
            </Button>
          }
        />
      </>
    );
  }

  // Key by id so edit state and drafts reset when switching docs
  return <DocView key={doc.id} doc={doc} />;
}

function DocView({ doc }: { doc: WikiDoc }) {
  const router = useRouter();
  const members = useAppStore((s) => s.members);
  const updateWikiDoc = useAppStore((s) => s.updateWikiDoc);
  const deleteWikiDoc = useAppStore((s) => s.deleteWikiDoc);

  // New docs open straight into edit mode
  const [editing, setEditing] = useState(doc.content.trim() === "");
  const [draft, setDraft] = useState(doc.content);

  // Re-sync the draft when content changes outside this editor (e.g.
  // Reset demo data) while we are not actively editing.
  const [synced, setSynced] = useState(doc.content);
  if (doc.content !== synced) {
    setSynced(doc.content);
    if (!editing) setDraft(doc.content);
  }

  const author = members.find((m) => m.id === doc.authorId) ?? null;

  // onBlur never fires when a focused textarea unmounts (browser back,
  // palette navigation), so also commit from an unmount cleanup. The ref
  // is refreshed in an effect each render so the cleanup sees the latest
  // draft without capturing render-time state.
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => {
    commitRef.current = () => {
      const current = useAppStore.getState().wikiDocs.find((d) => d.id === doc.id);
      if (current && draft !== current.content) updateWikiDoc(doc.id, { content: draft });
    };
  });
  useEffect(() => () => commitRef.current(), []);

  const commitDraft = () => commitRef.current();

  return (
    <>
      <PanelHeader
        left={
          <>
            <Link href="/wiki" className="text-muted-foreground hover:text-foreground">
              Wiki
            </Link>
            <ChevronRight strokeWidth={1.8} className="size-3 shrink-0 text-faint" />
            <span className="truncate">{doc.title}</span>
          </>
        }
        right={
          <>
            <Button
              size="xs"
              variant={editing ? "default" : "outline"}
              onClick={() => {
                if (editing) commitDraft();
                setEditing((e) => !e);
              }}
            >
              {editing ? (
                "Done"
              ) : (
                <>
                  <PencilLine strokeWidth={1.8} data-icon="inline-start" />
                  Edit
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Doc actions">
                  <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.8} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    // Navigate first so the not-found state never flashes
                    router.push("/wiki");
                    setTimeout(() => deleteWikiDoc(doc.id), 0);
                  }}
                >
                  Delete doc
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-6">
          <input
            defaultValue={doc.title}
            placeholder="Untitled"
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (!title) {
                e.target.value = doc.title;
                return;
              }
              if (title !== doc.title) updateWikiDoc(doc.id, { title });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-1 mb-6 flex items-center gap-2 text-xs text-faint">
            <MemberAvatar member={author} size="sm" />
            <span>{author?.name ?? "Unknown"}</span>
            <span>Updated {formatDate(doc.updatedAt)}</span>
          </div>

          {editing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              placeholder="Write in markdown: ## headings, - lists, ``` code fences, **bold**, `code`..."
              className="min-h-[420px] w-full resize-y bg-transparent font-mono text-xs leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground"
            />
          ) : (
            <DocMarkdown content={doc.content} />
          )}
        </div>
      </div>
    </>
  );
}
