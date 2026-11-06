import React, { useEffect, useId, useRef, useState } from 'react';
import { IconButton } from './Button';
import { useDialog } from './useDialog';

const WIDE = '(min-width: 1280px)';

function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const handleChange = () => setIsWide(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);
  return isWide;
}

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Shown above the title in place of its heading level, such as a project or "Meeting". */
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Opens from the right at 480px. Above 1280px the page behind stays usable, so there's no scrim;
 * below that it behaves like a modal, and on a phone it fills the screen.
 */
export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  title,
  headerActions,
  footer,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isWide = useIsWide();
  useDialog(panelRef, { isOpen, onClose, isModal: !isWide });

  if (!isOpen) return null;

  return (
    <>
      {!isWide && <div className="panel-scrim scrim z-40" onClick={onClose} aria-hidden="true" />}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={!isWide}
        aria-labelledby={titleId}
        tabIndex={-1}
        className="panel side-panel"
      >
        <div className="card-head">
          <h2 id={titleId} className="t-h2 grow">
            {title}
          </h2>
          {headerActions}
          <IconButton icon="close" label="Close" size="sm" onClick={onClose} />
        </div>
        <div className="grow overflow-y-auto card-pad">{children}</div>
        {footer && <div className="card-foot flex justify-end gap-2">{footer}</div>}
      </div>
    </>
  );
};
