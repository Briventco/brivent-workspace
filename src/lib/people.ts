import { Placement, Role, ROLE_LABELS } from '../api/types';

type Titled = Placement & { role?: Role };

/** What someone does: their position, then their department, then their access level. */
export function personTitle({ position, department, role }: Titled): string {
  return position?.name ?? department?.name ?? (role ? ROLE_LABELS[role] : '');
}

export function nameAndTitle(person: Titled & { name: string }): string {
  return [person.name, personTitle(person)].filter(Boolean).join(' · ');
}
