import React, { useId, useRef } from 'react';
import { IconButton } from './Button';
import { useDialog } from './useDialog';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const MAX_WIDTH = { sm: 'max-w-[400px]', md: 'max-w-[480px]', lg: 'max-w-[580px]' };

export const ModalBody: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`modal-body overflow-y-auto ${className}`} {...props} />
);

export const ModalFooter: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`modal-foot ${className}`} {...props} />
);

/** Children are a ModalBody and a ModalFooter, directly or inside a `contents` form. */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialog(dialogRef, { isOpen, onClose, isModal: true });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-scrim scrim" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`modal relative w-full max-h-full ${MAX_WIDTH[maxWidth]} ${
          // A short question stays a dialog on a phone. Forms take the whole screen.
          maxWidth === 'sm' ? '' : 'modal-full'
        }`}
      >
        <div className="modal-head">
          <div className="grow">
            <h2 id={titleId} className="t-h2">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-text-2">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
};
