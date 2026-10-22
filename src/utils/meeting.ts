export function getMeetingUrl(value: string): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const candidate = /^https?:\/\//i.test(raw)
    ? raw
    : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)
      ? `https://${raw}`
      : raw;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSameMeetingUrl(first: string | null, second: string | null): boolean {
  return Boolean(first && second && first === second);
}
