import type { EditorState } from '../shared/editorState';
import type { NationStat } from '../shared/protocol';
import { isLand, TERRAIN_IDS } from '../shared/terrain';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';


export interface EditorPanelProps {
  state: EditorState;
  nations: NationStat[];
  undo: number;
  redo: number;
  /** A line's first point is set (waiting for the second click). */
  lineStarted: boolean;
  onChange: (s: EditorState) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}

const LAND = TERRAIN_IDS.map((id, i) => [id, i] as const).filter(([, i]) => isLand(i));

/**
 * Map editor (PLAN 1.35): tool (brush, line, bucket), layer (nation or terrain), the value to
 * paint, brush radius, an optional target mask, and undo/redo (also Ctrl+Z / Ctrl+Y). While it is
 * open, map clicks paint.
 */
export function EditorPanel({ state, nations, undo, redo, lineStarted, onChange, onUndo, onRedo, onClose }: EditorPanelProps) {
  const set = (p: Partial<EditorState>) => onChange({ ...state, ...p });
  const sorted = [...nations].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  const nationOptions = (
    <>
      <option value={0}>{t('editor.unowned')}</option>
      {sorted.map((n) => (
        <option key={n.id} value={n.id}>
          {displayName(n.name)}
        </option>
      ))}
    </>
  );
  const terrainOptions = LAND.map(([id, i]) => (
    <option key={i} value={i}>
      {t(`terrain.${id}` as MessageKey)}
    </option>
  ));
  const num = (e: Event): number => Number((e.currentTarget as HTMLSelectElement).value);
  return (
    <aside class="history-panel editor-panel" data-testid="editor-panel">
      <header class="ranking-head">
        <span>{t('editor.title')}</span>
        <button type="button" class="panel-close" data-testid="editor-close" aria-label={t('panel.close')} onClick={onClose}>
          ×
        </button>
      </header>
      <div class="god-row">
        {(['brush', 'line', 'bucket'] as const).map((tool) => (
          <button key={tool} type="button" class={state.tool === tool ? 'god-btn active' : 'god-btn'} data-testid={`editor-tool-${tool}`} onClick={() => set({ tool })}>
            {t(`editor.tool.${tool}` as MessageKey)}
          </button>
        ))}
        <label class="editor-radius">
          {t('editor.radius')}
          <input data-testid="editor-radius" type="number" min={0} max={32} value={state.r} onInput={(e) => set({ r: Math.max(0, Math.min(32, Number((e.currentTarget as HTMLInputElement).value) || 0)) })} />
        </label>
      </div>
      <div class="god-row">
        <select data-testid="editor-layer" value={state.layer} onChange={(e) => set({ layer: (e.currentTarget as HTMLSelectElement).value as EditorState['layer'] })}>
          <option value="nation">{t('editor.layer.nation')}</option>
          <option value="terrain">{t('editor.layer.terrain')}</option>
        </select>
        {state.layer === 'nation' ? (
          <select data-testid="editor-nation" value={state.nation} onChange={(e) => set({ nation: num(e) })}>
            {nationOptions}
          </select>
        ) : (
          <select data-testid="editor-terrain" value={state.terrain} onChange={(e) => set({ terrain: num(e) })}>
            {terrainOptions}
          </select>
        )}
      </div>
      <div class="god-row">
        <span>{t('editor.mask')}</span>
        <select data-testid="editor-mask" value={state.mask} onChange={(e) => set({ mask: (e.currentTarget as HTMLSelectElement).value as EditorState['mask'] })}>
          <option value="none">{t('editor.mask.none')}</option>
          <option value="terrain">{t('editor.mask.terrain')}</option>
          <option value="nation">{t('editor.mask.nation')}</option>
        </select>
        {state.mask === 'terrain' ? (
          <select data-testid="editor-mask-terrain" value={state.maskTerrain} onChange={(e) => set({ maskTerrain: num(e) })}>
            {terrainOptions}
          </select>
        ) : state.mask === 'nation' ? (
          <select data-testid="editor-mask-nation" value={state.maskNation} onChange={(e) => set({ maskNation: num(e) })}>
            {nationOptions}
          </select>
        ) : null}
      </div>
      <div class="god-row">
        <button type="button" class="god-btn" data-testid="editor-undo" disabled={undo === 0} onClick={onUndo}>
          {t('editor.undo', { n: undo })}
        </button>
        <button type="button" class="god-btn" data-testid="editor-redo" disabled={redo === 0} onClick={onRedo}>
          {t('editor.redo', { n: redo })}
        </button>
      </div>
      <div class="panel-note" data-testid="editor-hint">
        {t(state.tool === 'line' && lineStarted ? 'editor.hint.lineEnd' : (`editor.hint.${state.tool}` as MessageKey))}
      </div>
    </aside>
  );
}
