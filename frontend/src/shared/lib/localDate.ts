export function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) return NaN;
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const date = new Date(value);
  return date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
    ? date.getTime()
    : NaN;
}

export function localDateTimeMax(now = Date.now()) {
  const date = new Date(now);
  return new Date(now - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
