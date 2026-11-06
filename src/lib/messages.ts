import { Conversation, LinkedTask, Message, Named, User } from '../api/types';
import { watDate } from './wat';

/** A follow-up from the same person after this long gets its own name and time again. */
const GROUP_WINDOW_MS = 10 * 60 * 1000;

const MENTION_MARKUP = /@\[([^\]]*)\]\(([^)]*)\)/g;
const BODY_TOKENS = /@\[([^\]]*)\]\(([^)]*)\)|https?:\/\/\S*?\/tasks\/([0-9a-f-]{36})/gi;

export type BodyPart =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; id: string; name: string }
  | { kind: 'task'; task: LinkedTask };

/** A mention the server recorded, a task this viewer can see, and everything else stays as text. */
export function bodyParts(
  body: string,
  mentions: Named[],
  linkedTasks: LinkedTask[],
): BodyPart[] {
  const parts: BodyPart[] = [];
  let cursor = 0;
  const addText = (text: string) => {
    if (text) parts.push({ kind: 'text', text });
  };

  for (const match of body.matchAll(BODY_TOKENS)) {
    const [token, name, id, taskId] = match;
    addText(body.slice(cursor, match.index));
    cursor = match.index + token.length;

    const task = taskId ? linkedTasks.find((linked) => linked.id === taskId) : undefined;
    if (task) parts.push({ kind: 'task', task });
    else if (taskId) addText(token);
    else if (mentions.some((mention) => mention.id === id)) parts.push({ kind: 'mention', id, name });
    else addText(`@${name}`);
  }
  addText(body.slice(cursor));

  // A message that's only a task link says it all in the card below it.
  const hasWords = parts.some(
    (part) => part.kind === 'mention' || (part.kind === 'text' && part.text.trim()),
  );
  return hasWords ? parts : [];
}

/** What the composer holds: mentions read as @Name until the message is sent. */
export interface Draft {
  text: string;
  mentions: Named[];
}

export const EMPTY_DRAFT: Draft = { text: '', mentions: [] };

export function toDraft(body: string): Draft {
  const mentions: Named[] = [];
  const text = body.replace(MENTION_MARKUP, (_, name: string, id: string) => {
    mentions.push({ id, name });
    return `@${name}`;
  });
  return { text, mentions };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Longest names first, so "@Ada Lovelace" isn't caught by a mention of "@Ada". */
export function toBody({ text, mentions }: Draft): string {
  const byLength = [...mentions].sort((a, b) => b.name.length - a.name.length);
  if (byLength.length === 0) return text;

  const names = byLength.map(({ name }) => escapeRegExp(name)).join('|');
  return text.replace(new RegExp(`@(${names})(?![\\w-])`, 'g'), (_, name: string) => {
    const person = byLength.find((mention) => mention.name === name);
    return person ? `@[${person.name}](${person.id})` : `@${name}`;
  });
}

export function conversationName(conversation: Conversation): string {
  return conversation.otherUser?.name ?? conversation.name ?? 'Conversation';
}

export function conversationTitle(conversation: Conversation): string {
  const name = conversationName(conversation);
  return conversation.kind === 'CHANNEL' ? `#${name}` : name;
}

export const isDeactivated = (conversation: Conversation) =>
  conversation.otherUser?.status === 'DEACTIVATED';

/**
 * #general can't be left or archived. The API only marks #announcements, so #general goes by
 * name: if someone renames it, Leave still shows, and the server refuses with a clear message.
 */
const isDefaultChannel = ({ name, isAnnouncement }: Conversation) =>
  isAnnouncement || name === 'general';

export const canLeave = (conversation: Conversation, user: Pick<User, 'department'>) =>
  conversation.kind === 'CHANNEL' &&
  !isDefaultChannel(conversation) &&
  (!conversation.department || conversation.department.id !== user.department?.id);

export const canArchive = (conversation: Conversation) =>
  conversation.canManage && !isDefaultChannel(conversation) && !conversation.department;

/** Keeps each message once, oldest first, with the incoming copy winning. */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export const messageDay = (createdAt: string) => watDate(new Date(createdAt));

/** Whether this message continues the one before it, under the same name and time. */
export function continuesFrom(previous: Message | undefined, message: Message): boolean {
  if (!previous || previous.author.id !== message.author.id) return false;
  if (messageDay(previous.createdAt) !== messageDay(message.createdAt)) return false;
  return Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_WINDOW_MS;
}
