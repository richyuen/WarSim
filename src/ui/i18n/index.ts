/**
 * i18n (PROMPT.md "i18n from day one, English first"; PLAN 0.21).
 *
 * - Catalogs are flat JSON maps of message keys; `en.json` is the source of truth and its keys
 *   type `MessageKey`, so a missing key is a compile error.
 * - `t(key, params)` interpolates `{name}` placeholders. Reading `locale.value` inside `t`
 *   makes every Preact component that renders text re-render on a locale change.
 * - `qps` is a generated pseudo-locale (accented and bracketed): it reveals hard-coded strings
 *   and truncation in the UI without needing a translator.
 * - The choice persists in localStorage; the first visit follows navigator.language.
 */
import { signal } from '@preact/signals';
import en from './en.json';

export type MessageKey = keyof typeof en;
export const LOCALES = ['en', 'qps'] as const;
export type Locale = (typeof LOCALES)[number];

const STORAGE_KEY = 'warsim.locale';

const ACCENTS: Record<string, string> = {
  a: 'å', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

/** Pseudo-localises a message: accents letters outside {placeholders}, pads ~30% and brackets. */
export function pseudo(msg: string): string {
  let out = '';
  let depth = 0;
  for (const ch of msg) {
    if (ch === '{') depth++;
    if (depth === 0) out += ACCENTS[ch] ?? ch;
    else out += ch;
    if (ch === '}') depth = Math.max(0, depth - 1);
  }
  const pad = '·'.repeat(Math.ceil(msg.length * 0.3));
  return `⟦${out}${pad}⟧`;
}

const catalogs: Record<Locale, Record<string, string>> = {
  en,
  qps: Object.fromEntries(Object.entries(en).map(([k, v]) => [k, pseudo(v)])),
};

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* storage unavailable (private mode): fall through */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en';
  return isLocale(nav) ? nav : 'en';
}

export const locale = signal<Locale>(initialLocale());

export function setLocale(l: Locale): void {
  locale.value = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* not persisted */
  }
  document.documentElement.lang = l === 'qps' ? 'en-XA' : l;
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const msg = catalogs[locale.value][key] ?? en[key];
  if (!params) return msg;
  return msg.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Display name of an i18n key, or of a '=' + literal name (spawned nations). */
export function displayName(key: string): string {
  return key.startsWith('=') ? key.slice(1) : t(key as MessageKey);
}
