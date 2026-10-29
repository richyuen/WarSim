import { useEffect, useState } from 'preact/hooks';

/** The phone's width: the style sheet's `@media (max-width: 600px)`, which this must match. */
export const PHONE_QUERY = '(max-width: 600px)';

/** Whether the view is a phone's width, kept as it changes (a rotation, a resize). */
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
