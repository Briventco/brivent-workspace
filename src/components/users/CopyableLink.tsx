import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';

export const CopyableLink: React.FC<{ link: string }> = ({ link }) => {
  const toast = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setIsCopied(true);
    } catch {
      toast.error("Couldn't copy it. Select the link and copy it manually.");
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2 pl-3">
      <code className="grow min-w-0 break-all text-small">{link}</code>
      <Button variant="secondary" size="sm" onClick={handleCopy} icon={isCopied ? 'check' : 'link'}>
        {isCopied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
};
