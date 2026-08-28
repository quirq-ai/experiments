"use client";

import { useState } from "react";
import { Card, CountChip, Dot, PillButton, SignalBadge, Avatar } from "@/components/ui";
import { ChevronDownIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { SIGNAL_TYPES } from "@/lib/data";
import { useWorkspace } from "@/lib/store";

const dotFor = (name: string) =>
  SIGNAL_TYPES.find((s) => s.name === name)?.dot ?? "#a8a29e";

export default function WatcherPage() {
  const { watched, addWatched, removeWatched } = useWorkspace();
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SIGNAL_TYPES.map((s) => [s.name, true]))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addAccount() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addWatched({
        name: name.trim(),
        domain:
          domain.trim() ||
          `${name.trim().toLowerCase().replace(/\s+/g, "")}.com`,
        signals: SIGNAL_TYPES.filter((s) => checked[s.name]).map((s) => s.name),
      });
      setName("");
      setDomain("");
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add account");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await removeWatched(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove account");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex items-center justify-between px-5 py-3">
        <CountChip label="Accounts" count={watched.length} active />
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[13.5px] font-semibold">
          Watcher
        </span>
        <div className="flex items-center gap-2">
          <PillButton variant="outline" onClick={() => setModalOpen(true)}>
            <PlusIcon size={13} />
            Add accounts
          </PillButton>
          <div className="relative">
            <PillButton variant="gray" onClick={() => setSignalsOpen((v) => !v)}>
              Signals
              <ChevronDownIcon size={13} />
            </PillButton>
            {signalsOpen && (
              <Card className="absolute right-0 top-full z-20 mt-2 w-64 p-2">
                {SIGNAL_TYPES.map((s) => (
                  <label
                    key={s.name}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-chip"
                  >
                    <Dot color={s.dot} size={7} />
                    <span className="flex-1 truncate text-[12.5px] text-ink">
                      {s.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked[s.name] ?? false}
                      onChange={(e) =>
                        setChecked((prev) => ({
                          ...prev,
                          [s.name]: e.target.checked,
                        }))
                      }
                      className="h-3.5 w-3.5 accent-[#191817]"
                    />
                  </label>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>

      {error && !modalOpen && (
        <div className="mx-auto mt-2 max-w-[760px] px-6">
          <div className="rounded-lg bg-danger-bg px-4 py-2.5 text-[12.5px] text-danger">
            {error}
          </div>
        </div>
      )}

      {watched.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="text-center">
            <div className="text-[15px] font-medium text-ink">No accounts yet</div>
            <p className="mx-auto mt-2 max-w-[360px] text-[13.5px] leading-relaxed text-ink-soft">
              Add the companies you care about and Watcher alerts you the moment
              a buying signal fires.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-10">
          <div className="mx-auto mt-6 flex max-w-[760px] flex-col gap-3">
            {watched.map((a, i) => (
              <Card key={a.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar
                  char={a.name.charAt(0).toUpperCase()}
                  bg="#141b33"
                  size={38}
                  rounded="rounded-xl"
                />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-ink">
                    {a.name}
                  </div>
                  <div className="truncate text-[12.5px] text-ink-faint">
                    {a.domain}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden pl-2">
                  {a.signals.slice(0, i === 0 ? 1 : 3).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full bg-chip px-2 py-0.5"
                    >
                      <Dot color={dotFor(s)} size={5} />
                      <span className="whitespace-nowrap text-[11.5px] text-ink-soft">
                        {s}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {i === 0 ? (
                    <>
                      <SignalBadge type="Raised funding" dot="#34d399" />
                      <span className="text-[12.5px] text-ink-soft">
                        Signal fired today
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-faint">
                      <span className="orb inline-flex">
                        <Dot color="#34d399" size={6} />
                      </span>
                      Watching
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Stop watching ${a.name}`}
                    onClick={() => remove(a.id)}
                    className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-chip hover:text-ink"
                  >
                    <CloseIcon size={13} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/20"
          onClick={() => setModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Card className="w-[380px] p-5">
              <div className="text-[15px] font-semibold text-ink">
                Add an account
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1 block text-[12.5px] font-medium text-ink-soft">
                    Company name
                  </span>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAccount()}
                    placeholder="Acme Inc"
                    className="w-full rounded-lg border border-hairline bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12.5px] font-medium text-ink-soft">
                    Domain
                  </span>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAccount()}
                    placeholder="acme.com"
                    className="w-full rounded-lg border border-hairline bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint"
                  />
                </label>
              </div>
              {error && (
                <div className="mt-3 text-[12px] text-danger">{error}</div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <PillButton variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </PillButton>
                <PillButton
                  variant="dark"
                  onClick={addAccount}
                  disabled={!name.trim() || saving}
                >
                  {saving ? "Adding…" : "Add"}
                </PillButton>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
