import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Fechar"
          type="button"
        >
          <X size={18} />
        </button>
        {title && <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
