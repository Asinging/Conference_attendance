export const EVENT_NAME = 'HeavenWorld Ladies Conference 2026';

export const DAY1_DATE = '2026-05-09';
export const DAY2_DATE = '2026-05-10';

export const TIMEZONE_OFFSET_HOURS = 1;

export function getCurrentEventDay(now = new Date()) {
  const local = new Date(now.getTime() + TIMEZONE_OFFSET_HOURS * 3600 * 1000);
  const today = local.toISOString().slice(0, 10);
  if (today === DAY1_DATE) return 1;
  if (today === DAY2_DATE) return 2;
  return null;
}

export function isValidDay(day) {
  return day === 1 || day === 2;
}
