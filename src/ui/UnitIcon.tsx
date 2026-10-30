import type { TemplateInfo } from '../shared/protocol';

/**
 * A unit type's icon (the user's request, ADR-765): a small side-view silhouette on a glossy tile in
 * its branch's colour (land olive, sea navy, air sky), as Cities' tool tiles. Our own drawings, in
 * a 24 × 24 box, white with a dark shadow from the style sheet (`.unit-icon`).
 */
type Icon = 'infantry' | 'mountain' | 'cavalry' | 'garrison' | 'truck' | 'halftrack' | 'tank' | 'battleship' | 'destroyer' | 'carrier' | 'submarine' | 'freighter' | 'fighter' | 'bomber' | 'heavyBomber' | 'diver' | 'torpedoBomber' | 'parachute';

const PATHS: Record<Icon, string> = {
  infantry:
    'M11 2.6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7.3 4.6h7.4l-.9 1.2H8.2zM8 8.6h6l1.6 6.2h-2.2l-.8 7.2h-2.1l-.5-5-.5 5H7.4l-.3-7.2H5.4zM15.4 2.4l1.3-.5 3.1 11.2-1.3.4z',
  mountain: 'M1 21 8.2 8l3.3 5.4L14.4 9 23 21zM8.2 8l-2.1 3.8 2.1-1 2 1.2zM14.4 9l-1.7 2.8 1.7-.8 1.8 1.1z',
  cavalry: 'M6.5 21.5h11.5v-2.3c0-4.6-1.2-8.3-3.4-10.8l1.2-4.4-3.3 2.3C9.3 5.8 6 8.3 4.4 12.2l1.9 1.5 2.9-2.1.9 1.6c-1.7 1.8-3.3 3.8-3.6 6.6z',
  garrison: 'M3.5 21.5V9.5h3V6h2.2v3.5h2.2V6h2.2v3.5h2.2V6h2.2v3.5h3v12h-6.3v-5.2a2.2 2.2 0 0 0-4.4 0v5.2z',
  truck: 'M1.5 6.5h11.5v9.5H1.5zM13.8 9.5h4.6l3.4 3.9v3.6h-8zM6 15.3a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zM17.6 15.3a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z',
  halftrack: 'M1.5 9.5h12.3l2.3 3h4.2l1.8 3.3V17H1.5zM2 16.8h10.8a2.2 2.2 0 0 1 0 4.4H4.2a2.2 2.2 0 0 1 0-4.4zM18.6 15.8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM5 7.5h5.5v2H5z',
  tank: 'M2.5 15h19l-2.6 5H5.1zM4.5 11.4h14.8l1.7 3.2H2.9zM7.6 7.6h7.2l1.7 3.4H6.4zM15.6 8.3h7.6v1.5h-7.6z',
  battleship: 'M.8 15.2h22.4l-2.6 4.6H3.6zM6.5 12.6h3V10h2V6.4h1.6V10h2.4v2.6h3v2.2H6.5zM2.2 13.4h4v1.1h-4zM17.8 13.4h4v1.1h-4zM9.8 8.2h1.5V10H9.8z',
  destroyer: 'M.5 15.8h23l-3.2 3.8H2.6zM8 13h7.5v2.4H8zM10 10.2h1.6V13H10zM12.8 10.8h1.4V13h-1.4zM16.5 14h4.5v1.1h-4.5zM3 14h3.6v1.1H3z',
  carrier: 'M.6 11.6h22.8v2.2l-2.7 5.6H3.4l-2.8-5.6zM15 7.2h3.2v4.4H15zM16 5.2h1.2v2H16z',
  submarine: 'M1.6 15.2c0-2.2 3.4-3.4 10.4-3.4s10.4 1.2 10.4 3.4-3.4 3.4-10.4 3.4S1.6 17.4 1.6 15.2zM9.4 8.6h3.6l1.2 3.4H8.6zM11 5.2h1v3.6h-1zM21.6 13.6l1.6-1.6v6.4l-1.6-1.6z',
  freighter: 'M.8 14.6h22.4l-2.6 5.2H3.4zM2.4 10.6h4.2v4h-4.2zM8 11.4h9v3.2H8zM17.6 9.2h3.6v5.4h-3.6zM12 5.2h1.2v6.2H12zM8.2 6.4l4.4-1.2.3 1.1-4.4 1.2z',
  fighter:
    'M12 1.8c.9 0 1.4 1.2 1.4 3.1v4.6l8.8 3.3v2.1l-8.8-1.7v5.2l3.1 2v1.6L12 21.2l-4.5.8V20.4l3.1-2v-5.2l-8.8 1.7v-2.1l8.8-3.3V4.9c0-1.9.5-3.1 1.4-3.1z',
  bomber: 'M11 1.8h2l.8 3.2v3.8h8.8v3.4h-8.8v6.2l3.4 1.6V22H6.8v-2l3.4-1.6v-6.2H1.4V8.8h8.8V5zM4.8 6.6h2.2v5.6H4.8zM17 6.6h2.2v5.6H17z',
  heavyBomber:
    'M11 1.8h2l.8 3.2v3.8h8.8v3.4h-8.8v6.2l3.4 1.6V22H6.8v-2l3.4-1.6v-6.2H1.4V8.8h8.8V5zM3 7h1.8v4.8H3zM6.8 7h1.8v4.8H6.8zM15.4 7h1.8v4.8h-1.8zM19.2 7H21v4.8h-1.8z',
  diver:
    'M4.4 3.4c.6-.6 1.9-.1 3.2 1.2l3.3 3.3 9-3.8 1.5 1.5-7.4 5.1 3.7 3.7 3.6-.7 1.1 1.1-4.3 1.8-1.8 4.3-1.1-1.1.7-3.6-3.7-3.7-5.1 7.4L5.6 18.6l3.8-9-3.3-3.3C4.8 5 4.1 3.9 4.4 3.4zM3 19.6l2.2-2.2 1.4 1.4-2.2 2.2z',
  torpedoBomber:
    'M11 1.4h2l.8 3v3.4h8.8v3.2h-8.8v5.2l3.4 1.5v1.8H6.8v-1.8l3.4-1.5V11H1.4V7.8h8.8V4.4zM4.8 5.8h2.2v5H4.8zM17 5.8h2.2v5H17zM1 21.4c2-1.6 3.6-1.6 5.5 0s3.5 1.6 5.5 0 3.6-1.6 5.5 0 3.5 1.6 5.5 0v1.4c-2 1.5-3.6 1.5-5.5 0s-3.5-1.5-5.5 0-3.6 1.5-5.5 0-3.5-1.5-5.5 0z',
  parachute:
    'M12 1.6c5.6 0 9.8 3.6 10.2 8.4-1.2-1-2.4-1-3.4 0-1-1-2.4-1-3.4 0-1-1-2.4-1-3.4 0-1-1-2.4-1-3.4 0-1-1-2.2-1-3.4 0C2.2 5.2 6.4 1.6 12 1.6zM2.4 10.4l1-.6 7.4 7.6-.8.6zM21.6 10.4l-1-.6-7.4 7.6.8.6zM11.4 10h1.2v7.4h-1.2zM9 16.8h6v5.4H9z',
};

/** Each template's icon by its id (`template.<id>`); a template not here takes its symbol's or its domain's. */
const BY_ID: Readonly<Record<string, Icon>> = {
  mountain_div: 'mountain',
  cavalry_div: 'cavalry',
  cavalry_brigade: 'cavalry',
  garrison_brigade: 'garrison',
  motorised_div: 'truck',
  light_mech_div: 'halftrack',
  mech_div: 'halftrack',
  battle_squadron: 'battleship',
  cruiser_squadron: 'battleship',
  carrier_group: 'carrier',
  destroyer_flotilla: 'destroyer',
  submarine_flotilla: 'submarine',
  transport_group: 'freighter',
  fighter_group: 'fighter',
  tactical_bomber_group: 'bomber',
  strategic_bomber_group: 'heavyBomber',
  close_support_group: 'diver',
  naval_bomber_group: 'torpedoBomber',
  air_transport_group: 'parachute',
};

const BY_SYMBOL: Readonly<Record<TemplateInfo['symbol'], Icon>> = {
  infantry: 'infantry',
  armour: 'tank',
  motorised: 'truck',
  cavalry: 'cavalry',
  mountain: 'mountain',
  garrison: 'garrison',
  fleet: 'battleship',
};

const DOMAIN_CLASS = ['land', 'sea', 'air'] as const;

/** The icon a template is drawn with. */
export function iconOf(tp: Pick<TemplateInfo, 'nameKey' | 'symbol' | 'domain'>): Icon {
  const id = tp.nameKey.startsWith('template.') ? tp.nameKey.slice('template.'.length) : tp.nameKey;
  return BY_ID[id] ?? (tp.domain === 2 ? 'fighter' : BY_SYMBOL[tp.symbol] ?? 'infantry');
}

/** A template's icon tile, for a list row (it has no text: the row's name says what it is). */
export function UnitIcon({ template }: { template: Pick<TemplateInfo, 'nameKey' | 'symbol' | 'domain'> | undefined }) {
  if (!template) return null;
  const icon = iconOf(template);
  return (
    <span class={`unit-icon unit-icon-${DOMAIN_CLASS[template.domain] ?? 'land'}`} data-icon={icon} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d={PATHS[icon]} />
      </svg>
    </span>
  );
}
