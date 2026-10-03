/**
 * Player control of a nation (PLAN 1.33a). Taking control switches the nation's AI off (all
 * three AI layers skip it) and lets map clicks select its formations and order them to move.
 * Moving into enemy land is the attack order: movement stops at enemy cells and combat starts.
 * Releasing control switches its AI back on.
 */
import { signal } from '@preact/signals';
import type { Hud } from './hud';
import type { MapView } from './MapView';

export class PlayerControl {
  /** The controlled nation (0 = none) and how many of its formations are selected. */
  readonly nation = signal(0);
  readonly selectedCount = signal(0);

  constructor(
    private readonly hud: Hud,
    private readonly view: MapView,
  ) {}

  take(id: number): void {
    const prev = this.nation.value;
    if (prev === id) return;
    if (prev !== 0) this.hud.command({ kind: 'setAi', nation: prev, enabled: true });
    this.hud.command({ kind: 'setAi', nation: id, enabled: false });
    this.nation.value = id;
    this.clearSelection();
  }

  release(): void {
    const id = this.nation.value;
    if (id === 0) return;
    this.hud.command({ kind: 'setAi', nation: id, enabled: true });
    this.nation.value = 0;
    this.clearSelection();
  }

  clearSelection(): void {
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

  /**
   * A map click (cell x, y; CSS px sx, sy). On one of the player's formations: select it (Shift
   * toggles it in the selection). Elsewhere with a selection: order the selected formations to
   * march there. Returns true when the click was used.
   */
  click(x: number, y: number, sx: number, sy: number, shift: boolean): boolean {
    const n = this.nation.value;
    if (n === 0) return false;
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
    for (const id of [...sel].sort((a, b) => a - b)) this.hud.command({ kind: 'moveFormation', id, x: x + 0.5, y: y + 0.5 });
    return true;
  }
}
