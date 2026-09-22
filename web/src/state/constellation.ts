import { create } from "zustand";

export type ConstellationSpeed = 1 | 4 | 16;
// lanes: rows with strips on the shared axis. one: a single shared radial
// map with every session's light unioned onto it. world: the same union on
// the flat terrain — every folder a district, like countries on a world map.
export type ConstellationLayout = "lanes" | "one" | "world";

interface ConstellationState {
  open: boolean;
  layout: ConstellationLayout;
  selectedKeys: string[];
  focusedKey?: string;
  cursorC: number;
  playing: boolean;
  speed: ConstellationSpeed;
  loading: boolean;
  error?: string;
  setOpen: (open: boolean) => void;
  setLayout: (layout: ConstellationLayout) => void;
  setSelectedKeys: (selectedKeys: string[]) => void;
  toggleKey: (key: string) => void;
  setFocusedKey: (focusedKey?: string) => void;
  setCursorC: (cursorC: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: ConstellationSpeed) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
}

// Constellation UI state only. Heavy lane data (traces, citymaps, engines)
// lives in ConstellationView refs — mutable class instances don't belong in
// zustand. Closing keeps cursorC and selectedKeys so reopening resumes at
// the same moment after a refetch.
export const useConstellationStore = create<ConstellationState>((set) => ({
  open: false,
  layout: "lanes",
  selectedKeys: [],
  cursorC: 0,
  playing: false,
  speed: 1,
  loading: false,
  // close pauses playback but deliberately keeps cursorC/selectedKeys
  setOpen: (open) => set(open ? { open } : { open, playing: false }),
  setLayout: (layout) => set({ layout }),
  // focus follows selection: a lane that leaves the set can't stay focused
  setSelectedKeys: (selectedKeys) =>
    set((s) => ({
      selectedKeys,
      focusedKey: s.focusedKey !== undefined && selectedKeys.includes(s.focusedKey) ? s.focusedKey : undefined
    })),
  toggleKey: (key) =>
    set((s) => {
      const on = s.selectedKeys.includes(key);
      return {
        selectedKeys: on ? s.selectedKeys.filter((k) => k !== key) : [...s.selectedKeys, key],
        focusedKey: on && s.focusedKey === key ? undefined : s.focusedKey
      };
    }),
  setFocusedKey: (focusedKey) => set({ focusedKey }),
  setCursorC: (cursorC) => set({ cursorC }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
