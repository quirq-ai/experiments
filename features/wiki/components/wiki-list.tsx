"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Ellipsis, FileText } from "lucide-react";
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

export function WikiList() {
  const router = useRouter();
  const wikiDocs = useAppStore((s) => s.wikiDocs);
  const members = useAppStore((s) => s.members);
  const createWikiDoc = useAppStore((s) => s.createWikiDoc);
  const deleteWikiDoc = useAppStore((s) => s.deleteWikiDoc);

  const newDoc = () => {
    const doc = createWikiDoc();
    router.push(`/wiki/${doc.id}`);
  };

  return (
    <>
      <PanelHeader
        left={<span>Wiki</span>}
        right={
          <Button size="xs" onClick={newDoc}>
            New doc
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {wikiDocs.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No docs yet"
            description="Write down how things work so the team stops asking."
            action={
              <Button size="xs" onClick={newDoc}>
                New doc
              </Button>
            }
          />
        ) : (
          wikiDocs.map((doc) => {
            const author = members.find((m) => m.id === doc.authorId) ?? null;
            return (
              <Link
                key={doc.id}
                href={`/wiki/${doc.id}`}
                className="flex h-10 items-center gap-2.5 px-4 hover:bg-accent"
              >
                <FileText strokeWidth={1.8} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {doc.title}
                </span>
                <span className="hidden text-xs text-faint sm:block">
                  Updated {formatDate(doc.updatedAt)}
                </span>
                <MemberAvatar member={author} size="sm" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Doc actions"
                      onClick={(e) => {
                        // Keep the wrapping Link from navigating
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <Ellipsis className="size-4 text-muted-foreground" strokeWidth={1.8} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => deleteWikiDoc(doc.id)}
                    >
                      Delete doc
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
