import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            className="rounded-full bg-line px-3 py-1 text-xs font-semibold text-muted"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
