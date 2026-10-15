import { StoreHydrated } from "@/components/providers/store-hydrated";
import { AppShell } from "@/components/shell/app-shell";
import { CommandPalette } from "@/components/shell/command-palette";
import { GlobalHotkeys } from "@/components/shell/global-hotkeys";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NewIssueModal } from "@/features/issues/components/new-issue-modal";
import { SetupDialog } from "@/features/setup/components/setup-dialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <AppShell>
        <StoreHydrated>{children}</StoreHydrated>
      </AppShell>
      <NewIssueModal />
      <CommandPalette />
      <SetupDialog />
      <GlobalHotkeys />
    </TooltipProvider>
  );
}
