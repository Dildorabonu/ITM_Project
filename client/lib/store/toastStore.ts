import { create } from "zustand";

export type Toast = {
  id: string;
  message: string;
  title?: string;
};

type ToastStore = {
  toasts: Toast[];
  show: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, title = "Muvaffaqiyatli!") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, title }] }));
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
