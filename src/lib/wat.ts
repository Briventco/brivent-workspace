/** Times are stored in UTC and always shown in West Africa Time, wherever the viewer is. */
const TIME_ZONE = 'Africa/Lagos';
const UTC_OFFSET = '+01:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const parts = (date: Date, options: Intl.DateTimeFormatOptions, locale = 'en-GB') =>
  Object.fromEntries(
    new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...options })
      .formatToParts(date)
      // en-GB shortens September to the four-letter "Sept".
      .map(({ type, value }) => [type, value === 'Sept' ? 'Sep' : value]),
  ) as Record<string, string>;

/** The WAT calendar date as YYYY-MM-DD, the format the API uses for check-ins. */
export function watDate(date: Date = new Date()): string {
  const { year, month, day } = parts(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${year}-${month}-${day}`;
}

export const watDayStart = (date: string) => new Date(`${date}T00:00:00${UTC_OFFSET}`);

/** Whole calendar days from a to b, in WAT. */
export const daysBetween = (a: Date, b: Date) =>
  Math.round((watDayStart(watDate(b)).getTime() - watDayStart(watDate(a)).getTime()) / DAY_MS);

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const weekdayIndex = (date: Date) =>
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts(date, { weekday: 'short' }).weekday);

export function isWeekend(date: Date = new Date()): boolean {
  const day = weekdayIndex(date);
  return day === 0 || day === 6;
}

/** Weeks start on Monday at midnight WAT, as they do for the API's "done this week". */
export function weekStart(date: Date = new Date()): Date {
  const daysSinceMonday = (weekdayIndex(date) + 6) % 7;
  return watDayStart(watDate(addDays(date, -daysSinceMonday)));
}

export function greeting(date: Date = new Date()): string {
  const hour = Number(parts(date, { hour: '2-digit', hour12: false }).hour);
  if (hour < 12) return 'Good morning';
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** Minutes since midnight WAT, for the 11:00 and 18:00 check-in cut-offs. */
export function watMinutes(date: Date = new Date()): number {
  const { hour, minute } = parts(date, { hour: '2-digit', minute: '2-digit', hour12: false });
  return Number(hour) * 60 + Number(minute);
}

/** Friday, 6 November */
export function formatLongDate(date: Date = new Date()): string {
  const { weekday, day, month } = parts(date, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${weekday}, ${day} ${month}`;
}

/** Mon, 9 Nov */
export function formatShortDate(date: Date): string {
  const { weekday, day, month } = parts(date, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${weekday}, ${day} ${month}`;
}

/** Thursday, 5 Nov */
export function formatDayHeading(date: Date): string {
  const { weekday, day, month } = parts(date, { weekday: 'long', day: 'numeric', month: 'short' });
  return `${weekday}, ${day} ${month}`;
}

/** Dec 18 */
export function formatMonthDay(date: Date): string {
  const { month, day } = parts(date, { month: 'short', day: 'numeric' }, 'en-US');
  return `${month} ${day}`;
}

/** 18 Dec 2026, or 18 Dec with no year */
export function formatDayMonth(date: Date, withYear = true): string {
  const { day, month, year } = parts(date, { day: 'numeric', month: 'short', year: 'numeric' });
  return withYear ? `${day} ${month} ${year}` : `${day} ${month}`;
}

/** { weekday: 'Mon', day: '2' }, for a column heading or the day strip. */
export function weekdayAndDay(date: Date): { weekday: string; day: string } {
  const { weekday, day } = parts(date, { weekday: 'short', day: 'numeric' });
  return { weekday, day };
}

/** 2 to 6 November, or 30 Nov to 4 Dec across two months. */
export function formatDayRange(first: Date, last: Date): string {
  const start = parts(first, { day: 'numeric', month: 'long' });
  const end = parts(last, { day: 'numeric', month: 'long' });
  if (start.month === end.month) return `${start.day} to ${end.day} ${end.month}`;
  return `${formatDayMonth(first, false)} to ${formatDayMonth(last, false)}`;
}

/** 15:00 */
export function format24Hour(date: Date): string {
  const { hour, minute } = parts(date, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${hour}:${minute}`;
}

/** 3:00 */
export function formatClock(date: Date): string {
  return formatTime(date).split(' ')[0];
}

/** 9:14 AM */
export function formatTime(date: Date): string {
  const { hour, minute, dayPeriod } = parts(
    date,
    { hour: 'numeric', minute: '2-digit', hour12: true },
    'en-US',
  );
  return `${hour}:${minute} ${dayPeriod}`;
}

/** 6 Nov 2026, 17:30 */
export function formatDateTime(date: Date): string {
  const { day, month, year, hour, minute } = parts(date, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

/** The value a datetime-local input expects, in WAT. */
export function toDateTimeInput(date: Date): string {
  const { hour, minute } = parts(date, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${watDate(date)}T${hour}:${minute}`;
}

export const fromDateTimeInput = (value: string) => new Date(`${value}:00${UTC_OFFSET}`);
