import { Conversation, LinkedTask, Message, Named, ReplyQuote, User } from '../api/types';
import { watDate } from './wat';

/** A follow-up from the same person after this long gets its own name and time again. */
const GROUP_WINDOW_MS = 10 * 60 * 1000;

const MENTION_MARKUP = /@\[([^\]]*)\]\(([^)]*)\)/g;
const BODY_TOKENS = /@\[([^\]]*)\]\(([^)]*)\)|https?:\/\/\S*?\/tasks\/([0-9a-f-]{36})/gi;

export type BodyPart =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; id: string; name: string }
  | { kind: 'task'; task: LinkedTask }
  | { kind: 'link'; href: string; text: string };

/**
 * Bare domains only count with one of these endings, so "e.g." or "report.pdf" stay as words.
 * Anything starting http:// or https:// is a link whatever its ending.
 */
const DOMAIN_ENDINGS =
  'com|co|org|net|io|ng|dev|app|ai|edu|gov|uk|me|info|biz|xyz|tech|africa|so|ly|to|gg|tv|us|ca|de|fr|in|za|ke|gh';
const LINK = new RegExp(
  `https?:\\/\\/[^\\s<>]+|(?<![@\\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${DOMAIN_ENDINGS})(?![\\w-])(?:\\/[^\\s<>]*)?`,
  'gi',
);
const TRAILING = /[.,;:!?'"]+$/;

/** Sentence punctuation after a link isn't part of it, nor is an unmatched closing bracket. */
function trimLink(raw: string): string {
  let link = raw.replace(TRAILING, '');
  while (link.endsWith(')') && (link.match(/\(/g)?.length ?? 0) < (link.match(/\)/g)?.length ?? 0)) {
    link = link.slice(0, -1).replace(TRAILING, '');
  }
  return link;
}

/** Splits plain text into words and links. Only http and https links are ever made clickable. */
export function linkify(text: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK)) {
    const link = trimLink(match[0]);
    if (!link) continue;
    if (match.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.index) });
    const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    parts.push({ kind: 'link', href, text: link });
    cursor = match.index + link.length;
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}

const SHORT_LINK = 48;

/** Long addresses are cut in the middle, keeping the site and the end, which say the most. */
export function shortenLink(text: string): string {
  const shown = text.replace(/^https?:\/\/(www\.)?/i, '');
  if (shown.length <= SHORT_LINK) return shown;
  return `${shown.slice(0, 30)}…${shown.slice(-15)}`;
}

/** A mention the server recorded, a task this viewer can see, and everything else stays as text. */
export function bodyParts(
  body: string,
  mentions: Named[],
  linkedTasks: LinkedTask[],
): BodyPart[] {
  const parts: BodyPart[] = [];
  let cursor = 0;
  const addText = (text: string) => {
    if (text) parts.push(...linkify(text));
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
    (part) =>
      part.kind === 'mention' || part.kind === 'link' || (part.kind === 'text' && part.text.trim()),
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

const QUOTE_LENGTH = 140;

/** A quote's text the way the server builds it: plain, with mentions as @Name. */
export const quotePreview = (body: string) =>
  body.replace(MENTION_MARKUP, '@$1').slice(0, QUOTE_LENGTH);

export function quoteOf(message: Message): ReplyQuote {
  return {
    id: message.id,
    author: { id: message.author.id, name: message.author.name },
    bodyPreview: message.body === null ? null : quotePreview(message.body),
    attachmentKind: message.attachments[0]?.kind ?? null,
    deletedAt: message.deletedAt,
  };
}

/**
 * No event is sent for each quote of an edited or deleted message, so every reply that quotes it
 * is brought up to date here.
 */
export function refreshQuotes(messages: Message[], changed: Message): Message[] {
  if (!messages.some(({ replyTo }) => replyTo?.id === changed.id)) return messages;
  return messages.map((message) =>
    message.replyTo?.id === changed.id
      ? { ...message, replyTo: { ...quoteOf(changed), attachmentKind: message.replyTo.attachmentKind } }
      : message,
  );
}

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
