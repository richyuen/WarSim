import { useEffect, useState } from 'preact/hooks';

/**
 * A phone's screen, upright (its width) or on its side (its height; the user's report: in
 * landscape the news filled the view too). The style sheet's `@media (max-width: 600px),
 * (max-height: 500px)`, which this must match.
 */
export const PHONE_QUERY = '(max-width: 600px), (max-height: 500px)';

/** Whether the view is a phone's, kept as it changes (a rotation, a resize). */
export function usePhone(): boolean {
  const query = typeof window === 'undefined' ? null : window.matchMedia(PHONE_QUERY);
  const [phone, setPhone] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const on = (): void => setPhone(query.matches);
    on();
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return phone;
}
