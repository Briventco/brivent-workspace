import { request } from './client';
import { Conversation, Message } from './types';

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
}

export interface NewChannel {
  name: string;
  description: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  memberIds: string[];
}

export interface ChannelChanges {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
}

const toConversation = (data: { conversation: Conversation }) => data.conversation;
const toMessage = (data: { message: Message }) => data.message;

/** Yours, latest activity first, leaving out anything archived. */
export async function listConversations(signal?: AbortSignal): Promise<Conversation[]> {
  const data = await request<{ conversations: Conversation[] }>('/conversations', { signal });
  return data.conversations;
}

/** Public channels you're not in. */
export async function browseChannels(signal?: AbortSignal): Promise<Conversation[]> {
  const data = await request<{ channels: Conversation[] }>('/channels/browse', { signal });
  return data.channels;
}

export function createChannel(channel: NewChannel): Promise<Conversation> {
  return request<{ conversation: Conversation }>('/channels', {
    method: 'POST',
    body: channel,
  }).then(toConversation);
}

export function updateChannel(id: string, changes: ChannelChanges): Promise<Conversation> {
  return request<{ conversation: Conversation }>(`/channels/${id}`, {
    method: 'PATCH',
    body: changes,
  }).then(toConversation);
}

export function joinChannel(id: string): Promise<Conversation> {
  return request<{ conversation: Conversation }>(`/channels/${id}/join`, {
    method: 'POST',
  }).then(toConversation);
}

export async function leaveChannel(id: string): Promise<void> {
  await request(`/channels/${id}/leave`, { method: 'POST' });
}

/** Anyone already in is ignored. */
export function addChannelMembers(id: string, userIds: string[]): Promise<Conversation> {
  return request<{ conversation: Conversation }>(`/channels/${id}/members`, {
    method: 'POST',
    body: { userIds },
  }).then(toConversation);
}

/** Returns the existing DM if there is one. */
export function startDm(userId: string): Promise<Conversation> {
  return request<{ conversation: Conversation }>('/dms', {
    method: 'POST',
    body: { userId },
  }).then(toConversation);
}

/** Newest first, as the API sends them. `before` is a message id, for the page older than it. */
export function listMessages(
  conversationId: string,
  before?: string,
  signal?: AbortSignal,
): Promise<MessagePage> {
  const query = before ? `?before=${before}` : '';
  return request(`/conversations/${conversationId}/messages${query}`, { signal });
}

/** Resending the same clientId returns the original, so a retry can never post twice. */
export function sendMessage(
  conversationId: string,
  body: string,
  clientId: string,
  replyToId?: string,
): Promise<Message> {
  return request<{ message: Message }>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { body, clientId, ...(replyToId && { replyToId }) },
  }).then(toMessage);
}

export function editMessage(id: string, body: string): Promise<Message> {
  return request<{ message: Message }>(`/messages/${id}`, {
    method: 'PATCH',
    body: { body },
  }).then(toMessage);
}

export function deleteMessage(id: string): Promise<Message> {
  return request<{ message: Message }>(`/messages/${id}`, { method: 'DELETE' }).then(toMessage);
}

export async function markRead(conversationId: string, messageId: string): Promise<void> {
  await request(`/conversations/${conversationId}/read`, {
    method: 'POST',
    body: { messageId },
  });
}

export function setMuted(conversationId: string, isMuted: boolean): Promise<Conversation> {
  return request<{ conversation: Conversation }>(`/conversations/${conversationId}/mute`, {
    method: 'PATCH',
    body: { isMuted },
  }).then(toConversation);
}
