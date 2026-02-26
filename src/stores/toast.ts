import { create } from "zustand";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  add: (type: Toast["type"], message: string) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      3000
    );
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
