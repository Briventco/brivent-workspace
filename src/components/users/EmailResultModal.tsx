import React from 'react';
import { EmailedLinkResult } from '../../api/users';
import { Button } from '../ui/Button';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
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
    <ModalBody>
      {result.emailSent ? (
        <p className="text-text-2">{sentMessage}</p>
      ) : (
        <>
          <p className="text-text-2">{failedMessage}</p>
          {result.link && (
            <>
              <p className="text-text-2">
                You must share this link with them yourself. It won't be shown again.
              </p>
              <CopyableLink link={result.link} />
            </>
          )}
        </>
      )}
    </ModalBody>
    <ModalFooter>
      <Button onClick={onClose} data-autofocus>
        Done
      </Button>
    </ModalFooter>
  </Modal>
);
