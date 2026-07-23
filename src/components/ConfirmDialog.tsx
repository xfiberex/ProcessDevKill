import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type ConfirmDialogProps = {
  request: ConfirmRequest | null;
  onCancel: () => void;
};

export function ConfirmDialog({ request, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape cancela, y el foco arranca en el boton destructivo para poder
  // confirmar con Enter sin tocar el raton.
  useEffect(() => {
    if (!request) return;

    confirmRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, onCancel]);

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={request.title}
            className="w-full max-w-sm rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-5 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold">{request.title}</h2>
            <p className="mt-2 text-sm text-neutral-400">{request.message}</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                ref={confirmRef}
                onClick={() => {
                  request.onConfirm();
                  onCancel();
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
              >
                {request.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
