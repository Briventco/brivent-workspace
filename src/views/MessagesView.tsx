import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { ChatMessage, MessageChannel } from '../types';
import { Button } from '../components/ui/Button';
import {
  Hash,
  Send,
  MessageSquare,
  Paperclip,
  Smile,
  Shield,
  Lock,
  Search,
} from 'lucide-react';

export const MessagesView: React.FC = () => {
  const { currentUser, showToast } = useWorkspace();
  const channels = workspaceService.getChannels();
  const [selectedChannelId, setSelectedChannelId] = useState(channels[1]?.id || channels[0]?.id);
  const [inputText, setInputText] = useState('');

  // Invalidate state
  const [refreshTick, setRefreshTick] = useState(0);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];
  const messages = workspaceService.getMessages(selectedChannelId);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    workspaceService.sendMessage(selectedChannelId, inputText.trim());
    setInputText('');
    setRefreshTick((t) => t + 1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex h-[calc(100vh-170px)]">
      {/* Channels & Conversations Sidebar */}
      <div className="w-72 sm:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Internal Messages</h2>
          <p className="text-[11px] text-slate-500">Department channels & direct chats</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Department Channels */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1.5">
              Channels
            </span>
            <div className="space-y-0.5">
              {channels
                .filter((c) => !c.isDirectMessage)
                .map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      selectedChannelId === channel.id
                        ? 'bg-brivent-600 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Hash className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{channel.name}</span>
                    </span>
                    {channel.unreadCount > 0 && selectedChannelId !== channel.id && (
                      <span className="w-4 h-4 bg-brivent-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                        {channel.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* Direct Messages */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1.5">
              Direct Messages
            </span>
            <div className="space-y-0.5">
              {channels
                .filter((c) => c.isDirectMessage)
                .map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannelId(channel.id)}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      selectedChannelId === channel.id
                        ? 'bg-brivent-600 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img
                        src={channel.recipientUser?.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'}
                        alt={channel.name}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-300"
                      />
                      <span className="truncate">{channel.name}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Internal communications policy enforced.</span>
        </div>
      </div>

      {/* Chat Thread Panel */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Channel Header */}
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brivent-50 text-brivent-600 rounded-lg">
              {selectedChannel.isDirectMessage ? (
                <MessageSquare className="w-4 h-4" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{selectedChannel.name}</h3>
              <p className="text-[11px] text-slate-500">
                {selectedChannel.isDirectMessage
                  ? `Private discussion with ${selectedChannel.name}`
                  : 'Team coordination stream'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              No messages yet in this conversation. Send a greeting!
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isMine ? 'flex-row-reverse' : ''}`}
                >
                  <img
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 mt-0.5"
                  />

                  <div className={`max-w-md ${isMine ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900">{msg.senderName}</span>
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-brivent-600 text-white rounded-tr-xs'
                          : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-300 p-2 shadow-2xs focus-within:border-brivent-500 focus-within:ring-2 focus-within:ring-brivent-500/20">
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              title="Attach document or asset"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${selectedChannel.name}...`}
              className="flex-1 text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
            />

            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!inputText.trim()}
              className="rounded-lg p-2"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

