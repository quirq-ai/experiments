"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { useUiStore } from "@/lib/ui-store";
import type { XoFolder } from "@/lib/types";

/*
  Setup: pick the XO root and select which top level folders under it
  count as projects. Opens from the sidebar; mounted once in
  app/(app)/layout.tsx like every global dialog. The choice persists in
  the store (xoConfig) and drives /api/xo/snapshot from then on.
  SetupForm mounts fresh each time the dialog opens, so its state
  initializes from the saved config without effect driven resets.
*/

type FoldersResult =
  | { ok: true; root?: string; folders: XoFolder[] }
  | { ok: false; error: string };

/** Pure fetch helper; all state updates happen in the caller's callbacks. */
async function requestFolders(rootPath: string): Promise<FoldersResult> {
  try {
    const params = rootPath ? `?root=${encodeURIComponent(rootPath)}` : "";
    const res = await fetch(`/api/xo/folders${params}`);
    const data: { root?: string; folders?: XoFolder[]; error?: string } = await res.json();
    if (!res.ok || !data.folders) {
      return { ok: false, error: data.error ?? "Could not list folders" };
    }
    return { ok: true, root: data.root, folders: data.folders };
  } catch {
    return { ok: false, error: "Could not reach /api/xo/folders" };
  }
}

export function SetupDialog() {
  const open = useUiStore((s) => s.setupOpen);
  const setOpen = useUiStore((s) => s.setSetupOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[14%] translate-y-0 p-0 sm:max-w-xl">
        {open ? <SetupForm close={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SetupForm({ close }: { close: () => void }) {
  const xoConfig = useAppStore((s) => s.xoConfig);
  const xoRoot = useAppStore((s) => s.xoRoot);
  const setXoConfig = useAppStore((s) => s.setXoConfig);

  const [root, setRoot] = useState(xoConfig.root ?? xoRoot ?? "");
  const [folders, setFolders] = useState<XoFolder[]>([]);
  const [selected, setSelected] = useState<string[]>(xoConfig.projects);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((result: FoldersResult, rootPath: string) => {
    if (result.ok) {
      setRoot(result.root ?? rootPath);
      setFolders(result.folders);
      setError(null);
    } else {
      setError(result.error);
      setFolders([]);
    }
    setLoading(false);
  }, []);

  const loadFolders = (rootPath: string) => {
    setLoading(true);
    setError(null);
    void requestFolders(rootPath).then((result) => applyResult(result, rootPath));
  };

  // Initial listing; loading starts true so no sync setState happens here.
  useEffect(() => {
    let cancelled = false;
    const initialRoot = xoConfig.root ?? "";
    void requestFolders(initialRoot).then((result) => {
      if (!cancelled) applyResult(result, initialRoot);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult, xoConfig.root]);

  const toggle = (name: string) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );

  const save = async () => {
    setSaving(true);
    const ok = await setXoConfig({ root: root || null, projects: selected });
    setSaving(false);
    if (ok) close();
    else setError(useAppStore.getState().syncError ?? "Sync failed");
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FolderOpen className="size-4 text-muted-foreground" strokeWidth={1.8} />
        <DialogTitle className="text-base font-medium">Setup</DialogTitle>
      </div>

      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-medium text-faint" htmlFor="xo-root">
            XO root
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="xo-root"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadFolders(root);
              }}
              placeholder="Absolute path containing .xo and your project folders"
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadFolders(root)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <RefreshCw className="size-4" strokeWidth={1.8} />
              )}
              Load
            </Button>
          </div>
          <p className="text-xs text-faint">
            Todos and work items load from .xo folders here. Defaults to XO_ROOT
            from the environment.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xs font-medium text-faint">Projects</span>
            <span className="text-2xs text-faint">
              {selected.length} of {folders.length} selected
            </span>
          </div>
          <ScrollArea className="h-64 rounded-md border">
            {folders.length === 0 && !loading ? (
              <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {error ?? "No folders found under this root"}
              </div>
            ) : (
              <div className="flex flex-col py-1">
                {folders.map((folder) => (
                  <button
                    key={folder.name}
                    onClick={() => toggle(folder.name)}
                    className="flex h-8 items-center gap-2.5 px-3 text-left hover:bg-accent"
                  >
                    <Checkbox
                      checked={selected.includes(folder.name)}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    <span className="truncate text-sm text-foreground">{folder.name}</span>
                    {folder.hasXo ? (
                      <span className="ml-auto rounded-full border border-input px-2 text-2xs text-muted-foreground">
                        .xo
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <p className="text-xs text-faint">
            Selected folders appear as projects; their todos and work items load in.
          </p>
        </div>

        {error && folders.length > 0 ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button variant="ghost" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || loading}>
          {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} /> : null}
          Save and sync
        </Button>
      </div>
    </>
  );
}
