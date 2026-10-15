"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
  Invite dialog for the members page. v0 has no real invites: submitting
  adds the member to the store directly and the new row is the feedback.
*/
export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const workspaceName = useAppStore((s) => s.workspace.name);
  const addMember = useAppStore((s) => s.addMember);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Member");

  const canSubmit = name.trim().length > 0 && EMAIL_RE.test(email.trim());

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setEmail("");
      setRole("Member");
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!canSubmit) return;
    addMember({ name: name.trim(), email: email.trim(), role });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {workspaceName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            className="h-8 text-sm"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="h-8 text-sm"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger size="sm" className="h-8 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Member">Member</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button size="xs" disabled={!canSubmit} onClick={submit}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
