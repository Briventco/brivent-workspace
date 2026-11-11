import React, { useState } from 'react';
import { useSession } from '../../context/AuthContext';
import { Link } from '../../lib/router';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';

const keyFor = (userId: string) => `brivent.picturePromptDismissed.${userId}`;

function wasDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(userId)) === 'true';
  } catch {
    return false;
  }
}

/**
 * A quiet nudge for anyone still showing initials. Dismissing it is remembered on this device,
 * which is all it needs: it's a convenience, and it goes for good once a picture is added.
 */
export const PicturePrompt: React.FC = () => {
  const { user } = useSession();
  const [isDismissed, setIsDismissed] = useState(() => wasDismissed(user.id));
  if (user.avatar || isDismissed) return null;

  const dismiss = () => {
    setIsDismissed(true);
    try {
      window.localStorage.setItem(keyFor(user.id), 'true');
    } catch {
      // Blocked storage only means it asks again next time.
    }
  };

  return (
    <aside
      aria-label="Add a profile picture"
      className="card flex items-center gap-3 px-4 py-3 mb-5"
    >
      <Avatar name={user.fullName} id={user.id} />
      <p className="grow min-w-0 text-small">
        <span className="font-semibold">Add a profile picture</span>
        <span className="text-text-2"> so people can put a face to your name. </span>
        <Link to="/settings" className="font-semibold whitespace-nowrap">
          Add a picture
        </Link>
      </p>
      <IconButton icon="close" size="sm" label="Dismiss" onClick={dismiss} />
    </aside>
  );
};
