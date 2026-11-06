import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

type ToastKind = 'success' | 'error';

interface ToastOptions {
  /** A second, quieter line. */
  description?: string;
  /** Such as Undo or Try again. Toasts with one stay up longer. */
  action?: { label: string; onClick: () => void };
}

interface Toast extends ToastOptions {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const DISMISS_MS = { success: 4000, error: 7000 };
const WITH_ACTION_MS = 10000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...options, id, kind, message }]);
      window.setTimeout(() => dismiss(id), options.action ? WITH_ACTION_MS : DISMISS_MS[kind]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => show('success', message, options),
      error: (message, options) => show('error', message, options),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className="toast">
            <Icon name={toast.kind === 'success' ? 'check_circle' : 'error'} filled />
            <div className="grow min-w-0">
              <p className="font-semibold break-words">{toast.message}</p>
              {toast.description && <p className="t2">{toast.description}</p>}
            </div>
            {toast.action && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </Button>
            )}
            <IconButton
              icon="close"
              label="Dismiss notification"
              size="sm"
              className="text-nav-text hover:bg-transparent hover:text-white"
              onClick={() => dismiss(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
