import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const styles = {
    danger: {
      icon: AlertTriangle,
      iconWrap: 'bg-rose-100 text-rose-600',
      confirmButton: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-300',
    },
    warning: {
      icon: AlertTriangle,
      iconWrap: 'bg-amber-100 text-amber-600',
      confirmButton: 'bg-[#D97706] hover:bg-amber-700 focus:ring-amber-300',
    },
    info: {
      icon: Info,
      iconWrap: 'bg-blue-100 text-[#1E3A8A]',
      confirmButton: 'bg-[#1E3A8A] hover:bg-blue-900 focus:ring-blue-300',
    },
  }[variant];

  const Icon = styles.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95"
      >
        <div className="p-5 flex items-start gap-4">
          <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${styles.iconWrap}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-base font-extrabold text-slate-900 leading-snug">
              {title}
            </h3>
            <p id={messageId} className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            title="Tutup"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white font-bold text-xs rounded-xl shadow transition-colors focus:outline-none focus:ring-2 ${styles.confirmButton}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
