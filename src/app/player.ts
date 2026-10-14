/**
 * Player control of a nation (PLAN 1.33a). Taking control (`setPlayer`, sim state saved with
 * the world) switches the nation's AI off (all three AI layers skip it) and lets map clicks
 * select its formations and order them to move. Moving into enemy land is the attack order:
 * movement stops at enemy cells and combat starts. Releasing control switches its AI back on.
 * The controlled nation follows the sim (stats), so a load or resumed autosave keeps it.
 *
 * A wing's order (PLAN 5.8v1): its mission or rebase, chosen in the Actions tab, is armed
 * (`wingOrder`); the next map click gives it at the clicked cell, and Escape disarms it.
 */
import { signal } from '@preact/signals';
import type { Hud } from './hud';
import type { MapView } from './MapView';

/** What a wing can be ordered to do at a place (PLAN 5.8v1): a mission, or a rebase there. */
export type WingOrder = 'patrol' | 'strike' | 'supply' | 'rebase';

export class PlayerControl {
  /** The controlled nation (0 = none) and how many of its formations are selected. */
  readonly nation = signal(0);
  readonly selectedCount = signal(0);
  /** A wing's order waiting for its place on the map (PLAN 5.8v1), or null. */
  readonly wingOrder = signal<{ wing: number; kind: WingOrder } | null>(null);

  constructor(
    private readonly hud: Hud,
    private readonly view: MapView,
  ) {
    // The sim is the truth (a load may change the player): follow it from the stats.
    hud.sim.onStats((m) => {
      if (m.player !== this.nation.value) {
        this.nation.value = m.player;
        this.clearSelection();
      }
    });
    // A selected formation that is gone leaves the selection in the view; the count follows.
    view.onSelectionDropped = () => (this.selectedCount.value = view.selectedFormations.size);
    // A loaded world's formations are others, with the same ids (PLAN 2.16Rk).
    hud.sim.onLoad(() => this.clearSelection());
  }

  take(id: number): void {
    if (this.nation.value === id) return;
    this.hud.command({ kind: 'setPlayer', nation: id });
    this.nation.value = id;
    this.clearSelection();
  }

  release(): void {
    if (this.nation.value === 0) return;
    this.hud.command({ kind: 'setPlayer', nation: 0 });
    this.nation.value = 0;
    this.clearSelection();
  }

  clearSelection(): void {
    this.wingOrder.value = null;
    this.view.selectionNation = this.nation.value;
    this.view.selectedFormations.clear();
    this.selectedCount.value = 0;
    this.view.requestDraw();
  }

  /** Selects all formations of the controlled nation. */
  selectAll(): void {
    const n = this.nation.value;
    if (n === 0) return;
    for (const id of this.view.formationsOf(n)) this.view.selectedFormations.add(id);
    this.selectedCount.value = this.view.selectedFormations.size;
    this.view.requestDraw();
  }

  /** Arms wing `wing`'s order `kind` for the next map click (PLAN 5.8v1); the same again disarms it. */
  armWing(wing: number, kind: WingOrder): void {
    const now = this.wingOrder.value;
    this.wingOrder.value = now && now.wing === wing && now.kind === kind ? null : { wing, kind };
  }

  /**
   * A map click (cell x, y; CSS px sx, sy). With a wing's order armed: give it there. On one of the player's formations: select it (Shift
   * toggles it in the selection). Elsewhere with a selection: order the selected formations to
   * march there. Returns true when the click was used.
   */
  click(x: number, y: number, sx: number, sy: number, shift: boolean): boolean {
    const n = this.nation.value;
    if (n === 0) return false;
    // A wing's order armed (PLAN 5.8v1): this click is its place.
    const armed = this.wingOrder.value;
    if (armed) {
      this.wingOrder.value = null;
      const at = { id: armed.wing, x: x + 0.5, y: y + 0.5, nation: n };
      this.hud.command(armed.kind === 'rebase' ? { kind: 'wingRebase', ...at } : { kind: 'wingMission', mission: armed.kind, ...at });
      return true;
    }
    const sel = this.view.selectedFormations;
    const f = this.view.formationAt(sx, sy, n);
    if (f !== 0) {
      if (!shift) sel.clear();
      if (shift && sel.has(f)) sel.delete(f);
      else sel.add(f);
      this.selectedCount.value = sel.size;
      this.view.requestDraw();
      return true;
    }
    if (sel.size === 0) return false;
    for (const id of [...sel].sort((a, b) => a - b)) this.hud.command({ kind: 'moveFormation', id, x: x + 0.5, y: y + 0.5, nation: n });
    return true;
  }
}
