import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertCircle } from 'lucide-react';

interface BlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  taskTitle: string;
}

export const BlockerModal: React.FC<BlockerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a specific blocker description so your team lead can assist.');
      return;
    }
    onConfirm(reason);
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Declare Task Blocker"
      description={`Task: "${taskTitle}"`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <p className="font-semibold mb-0.5">Accountability Principle</p>
            <p>
              Declaring a blocker will immediately notify your team lead and operations coordinator so obstacles can be resolved without delay.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            What is currently blocking this task? *
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Waiting on third-party API credentials, pending client design approval, or missing documentation..."
            className="w-full text-sm rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder-slate-400"
          />
          {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger">
            Declare Blocker
          </Button>
        </div>
      </form>
    </Modal>
  );
};

