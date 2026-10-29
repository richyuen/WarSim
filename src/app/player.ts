/**
 * Player control of a nation (PLAN 1.33a). Taking control (`setPlayer`, sim state saved with
 * the world) switches the nation's AI off (all three AI layers skip it) and lets map clicks
 * select its formations and order them to move. Moving into enemy land is the attack order:
 * movement stops at enemy cells and combat starts. Releasing control switches its AI back on.
 * The controlled nation follows the sim (stats), so a load or resumed autosave keeps it.
 *
 * A wing's order (PLAN 5.8v1): its mission or rebase, chosen in the Actions tab, is armed
 * (`wingOrder`); the next map click gives it at the clicked cell, and Escape disarms it. So does
 * a paradrop of the selected formations (PLAN 5.8v2, `dropArmed`): each is dropped there.
 *
 * A click that selects a formation has the camera follow the selection (`MapView.followSelection`)
 * until the user pans, or the selection is empty. A box (a Shift-drag, a long press's drag:
 * `boxSelect`) adds its formations, Ctrl+Shift takes them out, and Ctrl+A selects all
 * (`selectAll`); both leave the camera where it is.
 *
 * A right-click on another nation's ground opens its menu (`menu`): declare war on it, or offer
 * peace in the war with it, and propose an alliance; the same commands as the Actions tab's. The
 * menu closes with its action, a press on the map, Escape, or a change of the nation played. What
 * the sim refuses of its action in the next seconds is told where the menu was (`menuNotice`).
 *
 * With God Mode on, a template of any domain can be armed for placing (`placing`): each map
 * click then puts one of the played nation's there at once, with no gold, training or research
 * (`spawnFormation`, `spawnFleet`, `spawnWing`), until Escape, another order armed, or God Mode off.
 */
import { signal } from '@preact/signals';
import type { Command } from '../shared/commands';
import type { Hud } from './hud';
import type { MapView } from './MapView';

/** What a wing can be ordered to do at a place (PLAN 5.8v1): a mission, or a rebase there. */
export type WingOrder = 'patrol' | 'strike' | 'supply' | 'rebase';

/** The menu of a nation opened by a right-click: the nation and where on the page. */
export interface NationMenu {
  nation: number;
  x: number;
  y: number;
}

/** How long after a menu's action a refusal is taken for its (ms): the sim answers a `now` command at once. */
const MENU_ANSWER_MS = 3000;
/** How long the words of a refusal stay (ms). */
const MENU_NOTICE_MS = 5000;

export class PlayerControl {
  /** The controlled nation (0 = none) and how many of its formations are selected. */
  readonly nation = signal(0);
  readonly selectedCount = signal(0);
  /** A wing's order waiting for its place on the map (PLAN 5.8v1), or null. */
  readonly wingOrder = signal<{ wing: number; kind: WingOrder } | null>(null);
  /** A paradrop of the selection waiting for its place on the map (PLAN 5.8v2). */
  readonly dropArmed = signal(false);
  /** The template armed for God Mode's placing, or null. */
  readonly placing = signal<number | null>(null);
  /** The menu of a nation opened by a right-click, or null; the refusal of its action, in words' key, where it was. */
  readonly menu = signal<NationMenu | null>(null);
  readonly menuNotice = signal<(NationMenu & { reason: number }) | null>(null);
  private menuSent: { at: number; menu: NationMenu } | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly hud: Hud,
    private readonly view: MapView,
  ) {
    // The sim is the truth (a load may change the player): follow it from the stats.
    hud.sim.onStats((m) => {
      if (m.player !== this.nation.value) {
        this.nation.value = m.player;
        this.closeMenu();
        this.clearSelection();
      }
    });
    // A selected formation that is gone leaves the selection in the view; the count follows.
    view.onSelectionDropped = () => {
      this.selectedCount.value = view.selectedFormations.size;
      if (view.selectedFormations.size === 0) view.followSelection(false);
    };
    // A loaded world's formations are others, with the same ids (PLAN 2.16Rk).
    hud.sim.onLoad(() => {
      this.clearSelection();
      this.closeMenu();
    });
    hud.sim.onRefused((reason) => {
      const sent = this.menuSent;
      if (!sent || performance.now() - sent.at > MENU_ANSWER_MS) return;
      this.menuSent = null;
      this.menuNotice.value = { ...sent.menu, reason };
      if (this.noticeTimer) clearTimeout(this.noticeTimer);
      this.noticeTimer = setTimeout(() => (this.menuNotice.value = null), MENU_NOTICE_MS);
    });
  }

  /** Opens the menu of `nation` at page point (x, y): only while playing, and for another nation. */
  openMenu(nation: number, x: number, y: number): void {
    this.menuNotice.value = null;
    this.menu.value = this.nation.value !== 0 && nation !== 0 && nation !== this.nation.value ? { nation, x, y } : null;
  }

  closeMenu(): void {
    this.menu.value = null;
  }

  /** The menu's action: the command is sent, and the menu closes; a refusal is told (`menuNotice`). */
  menuCommand(cmd: Command): void {
    const m = this.menu.value;
    if (!m) return;
    this.hud.command(cmd);
    this.menuSent = { at: performance.now(), menu: m };
    this.menu.value = null;
  }

  take(id: number): void {
    if (this.nation.value === id) return;
    this.closeMenu();
    this.hud.command({ kind: 'setPlayer', nation: id });
    this.nation.value = id;
    this.clearSelection();
  }

  release(): void {
    if (this.nation.value === 0) return;
    this.closeMenu();
    this.hud.command({ kind: 'setPlayer', nation: 0 });
    this.nation.value = 0;
    this.clearSelection();
  }

  clearSelection(): void {
    this.wingOrder.value = null;
    this.dropArmed.value = false;
    this.placing.value = null;
    this.view.selectionNation = this.nation.value;
    this.view.selectedFormations.clear();
    this.view.followSelection(false);
    this.selectedCount.value = 0;
    this.view.requestDraw();
  }

  /** Selects all formations of the controlled nation that a click orders (Ctrl+A): its land formations, else its fleets. The camera stays. */
  selectAll(): void {
    const n = this.nation.value;
    if (n === 0) return;
    this.view.selectedFormations.clear();
    for (const id of this.view.orderable(this.view.formationsOf(n))) this.view.selectedFormations.add(id);
    this.view.followSelection(false);
    this.selectedCount.value = this.view.selectedFormations.size;
    this.view.requestDraw();
  }

  /** A selection box's formations (`MapView.formationsInBox`): added, or taken out (`remove`). The camera stays. */
  boxSelect(ids: readonly number[], remove: boolean): void {
    if (this.nation.value === 0) return;
    const sel = this.view.selectedFormations;
    for (const id of ids) {
      if (remove) sel.delete(id);
      else sel.add(id);
    }
    this.view.followSelection(false);
    this.selectedCount.value = sel.size;
    this.view.requestDraw();
  }

  /** Arms wing `wing`'s order `kind` for the next map click (PLAN 5.8v1); the same again disarms it. */
  armWing(wing: number, kind: WingOrder): void {
    const now = this.wingOrder.value;
    this.dropArmed.value = false;
    this.placing.value = null;
    this.wingOrder.value = now && now.wing === wing && now.kind === kind ? null : { wing, kind };
  }

  /** Arms a paradrop of the selected formations for the next map click (PLAN 5.8v2); again disarms it. */
  armDrop(): void {
    this.wingOrder.value = null;
    this.placing.value = null;
    this.dropArmed.value = !this.dropArmed.value && this.view.selectedFormations.size > 0;
  }

  /** Arms template `t` for God Mode's placing (the same again disarms it); an armed God tool goes. */
  armPlace(t: number): void {
    this.wingOrder.value = null;
    this.dropArmed.value = false;
    this.placing.value = this.placing.value === t ? null : t;
    if (this.placing.value !== null) this.hud.setGodTool(null);
  }

  /** Disarms God Mode's placing (God Mode off). */
  stopPlacing(): void {
    this.placing.value = null;
  }

  /**
   * A map click (cell x, y; CSS px sx, sy). With a wing's order armed: give it there. On one of the player's formations: select it (Shift
   * toggles it in the selection). Elsewhere with a selection: order the selected formations to
   * march there. Returns true when the click was used.
   */
  click(x: number, y: number, sx: number, sy: number, shift: boolean): boolean {
    const n = this.nation.value;
    if (n === 0) return false;
    // God Mode's placing armed: one of the template's at the click, and it stays armed.
    const t = this.placing.value;
    if (t !== null) {
      const domain = this.hud.templates.peek()[t]?.domain ?? 0;
      const at = { nation: n, x: x + 0.5, y: y + 0.5, template: t };
      this.hud.command(domain === 1 ? { kind: 'spawnFleet', ...at, free: true } : domain === 2 ? { kind: 'spawnWing', ...at } : { kind: 'spawnFormation', ...at, strength: 0 });
      return true;
    }
    // A wing's order armed (PLAN 5.8v1): this click is its place.
    const armed = this.wingOrder.value;
    if (armed) {
      this.wingOrder.value = null;
      const at = { id: armed.wing, x: x + 0.5, y: y + 0.5, nation: n };
      this.hud.command(armed.kind === 'rebase' ? { kind: 'wingRebase', ...at } : { kind: 'wingMission', mission: armed.kind, ...at });
      return true;
    }
    // A paradrop armed (PLAN 5.8v2): the selection is dropped here.
    if (this.dropArmed.value) {
      this.dropArmed.value = false;
      for (const id of [...this.view.selectedFormations].sort((a, b) => a - b)) this.hud.command({ kind: 'paradrop', id, x: x + 0.5, y: y + 0.5, nation: n });
      return true;
    }
    const sel = this.view.selectedFormations;
    const f = this.view.formationAt(sx, sy, n);
    if (f !== 0) {
      if (!shift) sel.clear();
      if (shift && sel.has(f)) sel.delete(f);
      else sel.add(f);
      this.view.followSelection(sel.size > 0);
      this.selectedCount.value = sel.size;
      this.view.requestDraw();
      return true;
    }
    if (sel.size === 0) return false;
    for (const id of [...sel].sort((a, b) => a - b)) this.hud.command({ kind: 'moveFormation', id, x: x + 0.5, y: y + 0.5, nation: n });
    return true;
  }
}
