import { CheckinAnswers } from '../api/checkins';

/**
 * The API has no drafts: PUT /checkins/today submits. Unsent text stays on this device, under
 * this person and this date, and is removed on submit. Storage can be blocked, so nothing here
 * may throw: at worst a draft doesn't survive a refresh.
 */
const key = (userId: string, date: string) => `brivent.checkinDraft.${userId}.${date}`;

export function readDraft(userId: string, date: string): CheckinAnswers | null {
  try {
    const raw = window.localStorage.getItem(key(userId, date));
    return raw ? (JSON.parse(raw) as CheckinAnswers) : null;
  } catch {
    return null;
  }
}

export function writeDraft(userId: string, date: string, answers: CheckinAnswers): void {
  try {
    window.localStorage.setItem(key(userId, date), JSON.stringify(answers));
  } catch {
    // Nothing to do. Submitting still works.
  }
}

export function clearDraft(userId: string, date: string): void {
  try {
    window.localStorage.removeItem(key(userId, date));
  } catch {
    // Nothing to do. The draft is keyed by date, so it's never shown on another day.
  }
}
