import type { Refusal } from '../shared/commands';
import { REFUSAL_KEY } from './GodTab';
import { t } from './i18n';
import { displayName } from './NationPanel';

export interface NationMenuProps {
  /** The nation's name, and its flag's image. */
  name: string;
  flagUrl: string | null;
  /** Where on the page (CSS px): the menu opens beside it, inside the window. */
  x: number;
  y: number;
  /** The war of the played nation with this one, if any: peace is offered in it instead of war declared. */
  war: number | null;
  /** Whether the two are allies: no alliance is proposed. */
  allied: boolean;
  onWar: () => void;
  onPeace: (war: number) => void;
  onAlly: () => void;
}

/** The menu's width and most height, CSS px: it is kept inside the window. */
const MENU_W = 200;
const MENU_H = 110;

/** Keeps a box of w × h at (x, y) + 8 inside the window. */
function placed(x: number, y: number, w: number, h: number): { left: string; top: string } {
  const left = Math.max(4, Math.min(x + 8, window.innerWidth - w - 4));
  const top = Math.max(4, Math.min(y + 8, window.innerHeight - h - 4));
  return { left: `${left}px`, top: `${top}px` };
}

/**
 * The menu of a nation opened by a right-click on its ground while the player plays another
 * (`PlayerControl.openMenu`): declare war on it (or offer peace in the war with it) and propose
 * an alliance, the Actions tab's commands for that nation.
 */
export function NationMenu({ name, flagUrl, x, y, war, allied, onWar, onPeace, onAlly }: NationMenuProps) {
  return (
    <div class="nation-menu" data-testid="nation-menu" role="menu" style={placed(x, y, MENU_W, MENU_H)} onContextMenu={(e) => e.preventDefault()}>
      <div class="nation-menu-title">
        {flagUrl ? <img class="nation-menu-flag" src={flagUrl} alt="" /> : null}
        <span data-testid="nation-menu-name">{displayName(name)}</span>
      </div>
      {war === null ? (
        <button type="button" class="god-btn" role="menuitem" data-testid="nation-menu-war" onClick={onWar}>
          {t('god.war')}
        </button>
      ) : (
        <button type="button" class="god-btn" role="menuitem" data-testid="nation-menu-peace" onClick={() => onPeace(war)}>
          {t('act.offerPeace')}
        </button>
      )}
      <button type="button" class="god-btn" role="menuitem" data-testid="nation-menu-ally" disabled={allied || war !== null} onClick={onAlly}>
        {t('act.proposeAlliance')}
      </button>
    </div>
  );
}

/** The words of a refusal of the menu's action, where the menu was. */
export function NationMenuNotice({ name, x, y, reason }: { name: string; x: number; y: number; reason: number }) {
  const key = REFUSAL_KEY[reason as Exclude<Refusal, 0>];
  if (!key) return null;
  return (
    <div class="nation-menu nation-menu-notice" data-testid="nation-menu-notice" role="status" style={placed(x, y, MENU_W, 60)}>
      <div class="nation-menu-title">{displayName(name)}</div>
      <div class="panel-note">{t(key)}</div>
    </div>
  );
}
