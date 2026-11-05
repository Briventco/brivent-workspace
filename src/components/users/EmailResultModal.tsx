import React from 'react';
import { EmailedLinkResult } from '../../api/users';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { CopyableLink } from './CopyableLink';

interface EmailResultModalProps {
  result: EmailedLinkResult;
  sentTitle: string;
  sentMessage: string;
  /** What failed, and how else this person can get their link. */
  failedMessage: string;
  onClose: () => void;
}

export const EmailResultModal: React.FC<EmailResultModalProps> = ({
  result,
  sentTitle,
  sentMessage,
  failedMessage,
  onClose,
}) => (
  <Modal isOpen onClose={onClose} title={result.emailSent ? sentTitle : "Email didn't send"}>
    {result.emailSent ? (
      <p className="text-sm text-slate-700">{sentMessage}</p>
    ) : (
      <>
        <p className="text-sm text-slate-700">{failedMessage}</p>
        {result.link && (
          <>
            <p className="mt-3 text-sm text-slate-700">
              You must share this link with them yourself. It won't be shown again.
            </p>
            <CopyableLink link={result.link} />
          </>
        )}
      </>
    )}
    <div className="mt-6 flex justify-end">
      <Button onClick={onClose} data-autofocus>
        Done
      </Button>
    </div>
  </Modal>
);
