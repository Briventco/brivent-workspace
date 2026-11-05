import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';

export const TemporaryPassword: React.FC<{ password: string }> = ({ password }) => {
  const toast = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setIsCopied(true);
    } catch {
      toast.error("Couldn't copy it. Select the password and copy it manually.");
    }
  };

  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 pl-3.5">
      <code className="flex-1 min-w-0 break-all font-mono text-sm text-slate-900">{password}</code>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        leftIcon={
          isCopied ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )
        }
      >
        {isCopied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
};
