import { Sidebar } from "@/components/shell/sidebar";

/*
  Window layout: fixed sidebar on the left, main content in a rounded
  bordered panel (the Linear "sheet" look). Pages render inside the panel
  and manage their own PanelHeader + scroll area.
*/
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh w-full bg-background">
      <Sidebar />
      <main className="min-w-0 flex-1 py-2 pr-2">
        <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-panel">
          {children}
        </div>
      </main>
    </div>
  );
}
