import { SPAWN_NATION_MAX } from '../shared/commands';
import type { GodToolId as GodTool } from './GodTab';
import { t, type MessageKey } from './i18n';

const TOOLS: readonly GodTool[] = ['revolt', 'nation', 'battle', 'brush', 'nuke', 'city', 'raze'];
/** The tools that act for the selected nation. */
const OF_NATION: ReadonlySet<GodTool> = new Set(['battle', 'brush']);

export interface GodToolbarProps {
  tool: GodTool | null;
  onTool: (tool: GodTool) => void;
  /** The Spawn nation tool's provinces (PLAN 7.4f26). */
  spawnSize: number;
  onSpawnSize: (n: number) => void;
  /** The Nuke tool's size (PLAN 7.16a): a fission bomb or a thermonuclear one. */
  thermonuclear: boolean;
  onThermonuclear: (on: boolean) => void;
  /** A nation is selected (Breakthrough and Territory act for it). */
  nationSelected: boolean;
}

/**
 * God Mode's map tools (PLAN 7.16b; critic run 7: "the tools are hidden. Pressing God Mode changes
 * nothing on screen … at 1600 × 900 the map tools are below the fold"): a row on the bottom bar,
 * shown as soon as God Mode is on, a nation selected or not. A nation's own God powers stay in the
 * God tab of its panel.
 */
export function GodToolbar({ tool, onTool, spawnSize, onSpawnSize, thermonuclear, onThermonuclear, nationSelected }: GodToolbarProps) {
  return (
    <div class="god-tools" data-testid="god-tools">
      <span class="god-tools-name">{t('god.tools')}</span>
      {TOOLS.map((k) => (
        <button key={k} type="button" class={tool === k ? 'bar-btn active' : 'bar-btn'} data-testid={`god-tool-${k}`} aria-pressed={tool === k} onClick={() => onTool(k)}>
          {t(`god.tool.${k}` as MessageKey)}
        </button>
      ))}
      {tool === 'nuke' ? (
        <select class="god-tools-pick" data-testid="god-nuke-size" value={thermonuclear ? 'thermonuclear' : 'fission'} onChange={(e) => onThermonuclear((e.currentTarget as HTMLSelectElement).value === 'thermonuclear')}>
          <option value="fission">{t('god.nuke.fission')}</option>
          <option value="thermonuclear">{t('god.nuke.thermonuclear')}</option>
        </select>
      ) : null}
      {tool === 'nation' ? (
        <label class="god-tools-pick" data-testid="god-nation-size-row">
          <span>{t('god.nationSize', { n: spawnSize })}</span>
          <input type="range" data-testid="god-nation-size" min={1} max={SPAWN_NATION_MAX} step={1} value={spawnSize} onInput={(e) => onSpawnSize(Number((e.currentTarget as HTMLInputElement).value))} />
        </label>
      ) : null}
      {tool ? (
        <span class="god-tools-hint" data-testid="god-tool-hint">
          {t(OF_NATION.has(tool) && !nationSelected ? 'god.hint.pickNation' : (`god.hint.${tool}` as MessageKey))}
        </span>
      ) : null}
    </div>
  );
}
