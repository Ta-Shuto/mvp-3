"use client";

import { create } from "zustand";
import { useEffect } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

const typeStyles: Record<ToastType, string> = {
  success: "bg-emerald-500/90 border-emerald-400",
  error: "bg-red-500/90 border-red-400",
  warning: "bg-amber-500/90 border-amber-400",
  info: "bg-blue-500/90 border-blue-400",
};

const typeIcons: Record<ToastType, string> = {
  success: "\u2713",
  error: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-white shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${typeStyles[toast.type]}`}
    >
      <span className="text-lg font-bold">{typeIcons[toast.type]}</span>
      <p className="text-sm flex-1">{toast.message}</p>
      <button onClick={onClose} className="text-white/70 hover:text-white text-lg">
        &times;
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
