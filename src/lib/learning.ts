import { Enrollment, ItemStatus, LearningHealth, Track } from '../api/types';
import { formatDayMonth, watDayStart } from './wat';

export const HEALTH_LABELS: Record<LearningHealth, string> = {
  ON_TRACK: 'On track',
  BEHIND: 'Behind',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  NOT_STARTED: 'Not started',
  SUBMITTED: 'Waiting for review',
  CHANGES_REQUESTED: 'Changes requested',
  COMPLETED: 'Done',
};

/** Never through a browser timezone: these are West Africa Time calendar days. */
export const formatDay = (date: string) => formatDayMonth(watDayStart(date), false);

export const dueText = (date: string | null) => (date ? `Due ${formatDay(date)}` : 'No due date');

const HEALTH_ORDER: Record<LearningHealth, number> = {
  BEHIND: 0,
  ON_TRACK: 1,
  PAUSED: 2,
  COMPLETED: 3,
};

/** Whoever needs attention comes first. */
export const byHealth = (a: Enrollment, b: Enrollment) =>
  HEALTH_ORDER[a.progress.health] - HEALTH_ORDER[b.progress.health] ||
  a.learner.name.localeCompare(b.learner.name);

export interface OrderedModule {
  id: string;
  itemIds: string[];
}

export const orderOf = (track: Track): OrderedModule[] =>
  track.modules.map(({ id, items }) => ({ id, itemIds: items.map((item) => item.id) }));

/** Moves one item to before `beforeId` in a module, or to its end. */
export function placeItem(
  order: OrderedModule[],
  itemId: string,
  moduleId: string,
  beforeId: string | null,
): OrderedModule[] {
  return order.map((module) => {
    const itemIds = module.itemIds.filter((id) => id !== itemId);
    if (module.id !== moduleId) return { ...module, itemIds };
    const index = beforeId ? itemIds.indexOf(beforeId) : -1;
    itemIds.splice(index < 0 ? itemIds.length : index, 0, itemId);
    return { ...module, itemIds };
  });
}

/** One step up or down, crossing into the next module at either end. */
export function nudgeItem(
  order: OrderedModule[],
  itemId: string,
  step: -1 | 1,
): OrderedModule[] {
  const moduleIndex = order.findIndex(({ itemIds }) => itemIds.includes(itemId));
  const { id, itemIds } = order[moduleIndex];
  const index = itemIds.indexOf(itemId);
  const target = index + step;

  if (target >= 0 && target < itemIds.length) {
    const beforeId = step === -1 ? itemIds[target] : (itemIds[target + 1] ?? null);
    return placeItem(order, itemId, id, beforeId);
  }
  const neighbour = order[moduleIndex + step];
  if (!neighbour) return order;
  return placeItem(order, itemId, neighbour.id, step === 1 ? (neighbour.itemIds[0] ?? null) : null);
}

export function moveModule(order: OrderedModule[], moduleId: string, step: -1 | 1): OrderedModule[] {
  const index = order.findIndex(({ id }) => id === moduleId);
  const target = index + step;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
