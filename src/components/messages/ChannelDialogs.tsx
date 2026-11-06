import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import {
  addChannelMembers,
  browseChannels,
  createChannel,
  startDm,
  updateChannel,
} from '../../api/messages';
import { Conversation, PersonRef } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiQuery } from '../../lib/useApiQuery';
import { AssigneePicker } from '../tasks/AssigneePicker';
import { MultiAssigneePicker } from '../tasks/MultiAssigneePicker';
import { AsyncState } from '../ui/AsyncState';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

const MAX_MEMBERS = 200;
const LIMIT_NOTE = `You can add up to ${MAX_MEMBERS} people at once.`;

const VISIBILITY = [
  { value: 'PUBLIC', label: 'Public: anyone can find and join it' },
  { value: 'PRIVATE', label: 'Private: only people added can see it' },
];

/** Keeps the name to what the API takes, as it's typed. */
const toSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);

interface ChannelFormModalProps {
  /** Left out when creating. */
  channel?: Conversation;
  onClose: () => void;
  onSaved: (conversation: Conversation) => void;
}

export const ChannelFormModal: React.FC<ChannelFormModalProps> = ({ channel, onClose, onSaved }) => {
  const toast = useToast();
  const [name, setName] = useState(channel?.name ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [members, setMembers] = useState<PersonRef[]>([]);
  const [nameError, setNameError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = name.replace(/^-+|-+$/g, '');
    if (!slug) {
      setNameError('Give the channel a name.');
      return;
    }

    setIsSaving(true);
    setNameError(undefined);
    const about = description.trim() || null;
    try {
      onSaved(
        channel
          ? await updateChannel(channel.id, { name: slug, description: about })
          : await createChannel({
              name: slug,
              description: about,
              visibility,
              memberIds: members.map(({ id }) => id),
            }),
      );
    } catch (error) {
      setIsSaving(false);
      if (error instanceof ApiError && (error.code === 'CHANNEL_NAME_TAKEN' || error.fieldErrors.name)) {
        setNameError(error.fieldErrors.name ?? error.message);
      } else {
        toast.error(errorMessage(error));
      }
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={channel ? 'Edit channel' : 'New channel'}>
      <form onSubmit={submit} noValidate className="contents">
        <ModalBody className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(toSlug(e.target.value))}
            error={nameError}
            helperText="Lowercase letters, numbers and hyphens, like servra-launch."
            autoComplete="off"
          />
          <Textarea
            label="Description"
            optional
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {!channel && (
            <>
              <Select
                label="Who can see it"
                value={visibility}
                options={VISIBILITY}
                onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
              />
              <MultiAssigneePicker
                label="People"
                limit={MAX_MEMBERS}
                limitNote={LIMIT_NOTE}
                value={members}
                onChange={setMembers}
              />
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {channel ? 'Save changes' : 'Create channel'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export const AddMembersModal: React.FC<{
  channel: Conversation;
  onClose: () => void;
  onAdded: (conversation: Conversation, count: number) => void;
}> = ({ channel, onClose, onAdded }) => {
  const toast = useToast();
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    try {
      const ids = people.map(({ id }) => id);
      onAdded(await addChannelMembers(channel.id, ids), ids.length);
    } catch (error) {
      setIsSaving(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Add people to #${channel.name}`}
      description="Anyone already in the channel stays as they are."
    >
      <ModalBody>
        <MultiAssigneePicker
          label="People"
          limit={MAX_MEMBERS}
          limitNote={LIMIT_NOTE}
          value={people}
          onChange={setPeople}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={submit} isLoading={isSaving} disabled={people.length === 0}>
          Add people
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export const NewDmModal: React.FC<{
  onClose: () => void;
  onOpened: (conversation: Conversation) => void;
}> = ({ onClose, onOpened }) => {
  const { user } = useSession();
  const toast = useToast();

  const open = async (person: PersonRef | null) => {
    if (!person) return;
    try {
      onOpened(await startDm(person.id));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New direct message">
      <ModalBody className="min-h-[18rem]">
        <AssigneePicker
          label="Who do you want to message?"
          allowNone={false}
          value={null}
          excludeIds={[user.id]}
          onChange={open}
        />
      </ModalBody>
    </Modal>
  );
};

export const BrowseChannelsModal: React.FC<{
  onClose: () => void;
  onOpen: (channel: Conversation) => void;
}> = ({ onClose, onOpen }) => {
  const query = useApiQuery((signal) => browseChannels(signal), []);

  return (
    <Modal isOpen onClose={onClose} title="Browse channels" description="Public channels you're not in yet.">
      <ModalBody>
        <AsyncState
          query={query}
          loadingLabel="Loading channels…"
          errorTitle="Couldn't load channels"
          isEmpty={(channels) => channels.length === 0}
          empty={
            <EmptyState
              icon="tag"
              title="You're in every public channel"
              description="New channels will show here."
            />
          }
        >
          {(channels) => (
            <ul className="divide-y divide-border">
              {channels.map((channel) => (
                <li key={channel.id} className="flex items-center gap-3 py-2.5">
                  <Icon name="tag" size="sm" className="text-text-2" />
                  <div className="grow min-w-0">
                    <p className="font-semibold truncate">{channel.name}</p>
                    {channel.description && (
                      <p className="text-small text-text-2 truncate">{channel.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpen(channel)}
                    aria-label={`Open ${channel.name}`}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </AsyncState>
      </ModalBody>
    </Modal>
  );
};
