import React from 'react';
import { Conversation } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { canArchive, canLeave, conversationTitle } from '../../lib/messages';
import { Button } from '../ui/Button';
import { SidePanel } from '../ui/SidePanel';
import { Switch } from '../ui/Switch';

interface ConversationDetailsProps {
  conversation: Conversation;
  onClose: () => void;
  onToggleMute: (isMuted: boolean) => void;
  onAddPeople: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onLeave: () => void;
}

export const ConversationDetails: React.FC<ConversationDetailsProps> = ({
  conversation,
  onClose,
  onToggleMute,
  onAddPeople,
  onEdit,
  onArchive,
  onLeave,
}) => {
  const { user } = useSession();
  const { description, department, otherUser, isMuted, visibility, canManage } = conversation;

  return (
    <SidePanel isOpen onClose={onClose} title={conversationTitle(conversation)}>
      <div className="space-y-5">
        {description && <p className="whitespace-pre-wrap break-words">{description}</p>}
        {otherUser?.position && <p className="text-text-2">{otherUser.position.name}</p>}
        {department && (
          <p className="text-text-2">Everyone in {department.name} is in this channel.</p>
        )}
        {visibility === 'PRIVATE' && (
          <p className="text-text-2">Private: only people added can see this channel.</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Mute</p>
            <p className="text-small text-text-2">
              Leaves it out of your unread total. Mentions still count.
            </p>
          </div>
          <Switch label="Mute this conversation" checked={isMuted} onChange={onToggleMute} />
        </div>

        <div className="flex flex-col items-start gap-2">
          {visibility === 'PRIVATE' && (
            <Button variant="secondary" icon="person_add" onClick={onAddPeople}>
              Add people
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" icon="edit" onClick={onEdit}>
              Edit channel
            </Button>
          )}
          {canLeave(conversation, user) && (
            <Button variant="secondary" icon="logout" onClick={onLeave}>
              Leave channel
            </Button>
          )}
          {canArchive(conversation) && (
            <Button variant="danger" onClick={onArchive}>
              Archive channel
            </Button>
          )}
        </div>
      </div>
    </SidePanel>
  );
};
