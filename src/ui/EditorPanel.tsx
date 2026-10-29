import { useState } from 'preact/hooks';
import { MAX_PAINT_R } from '../shared/commands';
import type { EditorState } from '../shared/editorState';
import type { Refusal } from '../shared/commands';
import type { NationStat, RefusedBase, TemplateInfo } from '../shared/protocol';
import { isLand, TERRAIN_IDS } from '../shared/terrain';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';
import { FlagEditor } from './FlagEditor';
import { REFUSAL_KEY } from './GodTab';


const SCENARIO_TOOLS = ['city', 'removeCity', 'capital', 'core', 'uncore'] as const;
/** The editor's forces (PLAN 7.13a) and the domain of their templates (`TemplateInfo.domain`). */
const FORCE_TOOLS = [
  ['fleet', 1],
  ['wing', 2],
] as const;

export interface EditorPanelProps {
  state: EditorState;
  nations: NationStat[];
  /** Dead nations (cores for preset revolts, PLAN 1.36). */
  dead: { id: number; name: string }[];
  undo: number;
  redo: number;
  /** A line's first point is set (waiting for the second click). */
  lineStarted: boolean;
  onChange: (s: EditorState) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
  /** Scenario actions on the editor's nation (PLAN 1.36). */
  onGold: (nation: number, value: number) => void;
  onAnnex: (annexer: number, target: number) => void;
  /** Map import (PLAN 1.37a): an image file mapped onto a layer. */
  onImport: (file: File, layer: 'terrain' | 'nation') => void;
  /** Flag editor (PLAN 1.37b): the nation's current flag pixels, and saving or resetting it. */
  flagOf: (nation: number) => Uint32Array;
  onFlag: (nation: number, pixels: Uint32Array | null) => void;
  /** Scenario files (PLAN 1.38): export under a name, import a file; the result line. */
  onExportScenario: (name: string) => void;
  onImportScenario: (file: File) => void;
  scenarioStatus: string;
  /** The scenario's templates (a command's template id is the index; PLAN 7.13a: the fleet's and the wing's). */
  templates: TemplateInfo[];
  /** Warheads to the editor's nation (PLAN 7.13a). */
  onWarheads: (nation: number, count: number) => void;
  /** Why the last command from here was refused (`Refusal`, 0 none): a fleet or a wing with no place. */
  refusal: number;
  /** With a wing refused for want of an airbase (PLAN 7.24b): the nearest of its nation's with room, null for none. */
  refusalBase?: RefusedBase | null | undefined;
}

/** How a holder of warheads would deliver them (PLAN 7.37b2): its missiles, its strategic bomber groups and where the one kept for them stands. */
export function meansLine(name: string, m: NonNullable<NationStat['means']>): string {
  const base = m.base ?? '';
  if (m.missiles && m.bombers > 0) return t('editor.meansBoth', { name, count: m.bombers, base });
  if (m.missiles) return t('editor.meansMissiles', { name });
  return t(m.bombers === 1 ? 'editor.meansBombers.one' : 'editor.meansBombers', { name, count: m.bombers, base });
}

const LAND = TERRAIN_IDS.map((id, i) => [id, i] as const).filter(([, i]) => isLand(i));

/**
 * Map editor (PLAN 1.35): tool (brush, line, bucket), layer (nation or terrain), the value to
 * paint, brush radius, an optional target mask, and undo/redo (also Ctrl+Z / Ctrl+Y). While it is
 * open, map clicks paint.
 */
export function EditorPanel({ state, nations, dead, undo, redo, lineStarted, onChange, onUndo, onRedo, onClose, onGold, onAnnex, onImport, flagOf, onFlag, onExportScenario, onImportScenario, scenarioStatus, templates, onWarheads, refusal, refusalBase }: EditorPanelProps) {
  const [warheads, setWarheads] = useState('1');
  const [scenarioName, setScenarioName] = useState('');
  const [flagOpen, setFlagOpen] = useState(false);
  const [importLayer, setImportLayer] = useState<'terrain' | 'nation'>('terrain');
  const [gold, setGold] = useState('');
  const [annexTarget, setAnnexTarget] = useState(0);
  const me = nations.find((n) => n.id === state.nation);
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
      {[...dead]
        .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)))
        .map((n) => (
          <option key={n.id} value={n.id}>
            {t('editor.dead', { name: displayName(n.name) })}
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
          <input data-testid="editor-radius" type="number" min={0} max={MAX_PAINT_R} value={state.r} onInput={(e) => set({ r: Math.max(0, Math.min(MAX_PAINT_R, Number((e.currentTarget as HTMLInputElement).value) || 0)) })} />
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
      <div class="panel-sub">{t('editor.scenario')}</div>
      <div class="god-row">
        {SCENARIO_TOOLS.map((tool) => (
          <button key={tool} type="button" class={state.tool === tool ? 'god-btn active' : 'god-btn'} data-testid={`editor-tool-${tool}`} onClick={() => set({ tool })}>
            {t(`editor.tool.${tool}` as MessageKey)}
          </button>
        ))}
      </div>
      {state.tool === 'city' ? (
        <div class="god-row">
          <input data-testid="editor-city-name" placeholder={t('editor.cityName')} value={state.cityName} onInput={(e) => set({ cityName: (e.currentTarget as HTMLInputElement).value })} />
          <label class="editor-radius">
            {t('editor.citySize')}
            <input data-testid="editor-city-size" type="number" min={1} max={5} value={state.citySize} onInput={(e) => set({ citySize: Math.max(1, Math.min(5, Number((e.currentTarget as HTMLInputElement).value) || 1)) })} />
          </label>
        </div>
      ) : null}
      <div class="panel-sub">{t('editor.forces')}</div>
      <div class="god-row">
        {FORCE_TOOLS.map(([tool, domain]) => (
          <button
            key={tool}
            type="button"
            class={state.tool === tool ? 'god-btn active' : 'god-btn'}
            data-testid={`editor-tool-${tool}`}
            onClick={() => set({ tool, template: templates[state.template]?.domain === domain ? state.template : templates.findIndex((x) => x.domain === domain) })}
          >
            {t(`editor.tool.${tool}` as MessageKey)}
          </button>
        ))}
      </div>
      {state.tool === 'fleet' || state.tool === 'wing' ? (
        <div class="god-row">
          <select data-testid="editor-template" value={state.template} onChange={(e) => set({ template: num(e) })}>
            {templates.map((x, i) =>
              x.domain === (state.tool === 'fleet' ? 1 : 2) ? (
                <option key={i} value={i}>
                  {t(x.nameKey as MessageKey)}
                </option>
              ) : null,
            )}
          </select>
          {state.nation === 0 ? <span class="panel-note">{t('editor.forcesNation')}</span> : null}
        </div>
      ) : null}
      {refusal !== 0 && (state.tool === 'fleet' || state.tool === 'wing') ? (
        <div class="panel-warn" data-testid="editor-refusal" role="status">
          {t('refusal.lead')} {t(REFUSAL_KEY[refusal as Exclude<Refusal, 0>] ?? 'refusal.noEffect')}
          {me && refusalBase !== undefined ? (
            <div data-testid="editor-refusal-base">
              {refusalBase
                ? t('editor.nearestBase', { name: displayName(me.name), base: refusalBase.name, km: refusalBase.km.toLocaleString('en-US') })
                : t('editor.noBaseRoom', { name: displayName(me.name) })}
            </div>
          ) : null}
        </div>
      ) : null}
      {me ? (
        <div class="god-row">
          <span data-testid="editor-warheads-of">{t('editor.warheadsOf', { name: displayName(me.name), count: me.warheads })}</span>
          <input data-testid="editor-warheads" type="number" min={1} max={100} value={warheads} onInput={(e) => setWarheads((e.currentTarget as HTMLInputElement).value)} />
          <button type="button" class="god-btn" data-testid="editor-warheads-add" disabled={!(Number(warheads) >= 1)} onClick={() => onWarheads(me.id, Math.floor(Number(warheads)))}>
            {t('editor.add')}
          </button>
        </div>
      ) : null}
      {me && me.warheads > 0 && me.canDeliver && me.means ? (
        <div class="panel-note" data-testid="editor-means">
          {meansLine(displayName(me.name), me.means)}
        </div>
      ) : null}
      {me && me.warheads > 0 && !me.canDeliver ? (
        <div class="panel-note" data-testid="editor-no-delivery">
          {t(me.nukesAllowed ? 'editor.noDelivery' : 'editor.nukesBanned', { name: displayName(me.name) })}
        </div>
      ) : null}
      {me ? (
        <>
          <div class="god-row">
            <span>{t('editor.goldOf', { name: displayName(me.name) })}</span>
            <input data-testid="editor-gold" type="number" placeholder={String(Math.round(me.gold))} value={gold} onInput={(e) => setGold((e.currentTarget as HTMLInputElement).value)} />
            <button type="button" class="god-btn" data-testid="editor-gold-set" disabled={gold.trim() === '' || !Number.isFinite(Number(gold))} onClick={() => onGold(me.id, Number(gold))}>
              {t('editor.set')}
            </button>
          </div>
          <div class="god-row">
            <select data-testid="editor-annex-target" value={annexTarget} onChange={(e) => setAnnexTarget(num(e))}>
              <option value={0}>{t('editor.annexPick')}</option>
              {sorted
                .filter((n) => n.id !== me.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {displayName(n.name)}
                  </option>
                ))}
            </select>
            <button type="button" class="god-btn" data-testid="editor-annex" disabled={annexTarget === 0} onClick={() => onAnnex(me.id, annexTarget)}>
              {t('editor.annex', { name: displayName(me.name) })}
            </button>
          </div>
        </>
      ) : null}
      {state.nation !== 0 ? (
        <>
          <div class="god-row">
            <button type="button" class={flagOpen ? 'god-btn active' : 'god-btn'} data-testid="editor-flag-open" onClick={() => setFlagOpen(!flagOpen)}>
              {t('flag.edit')}
            </button>
          </div>
          {flagOpen ? <FlagEditor initial={flagOf(state.nation)} onSave={(px) => onFlag(state.nation, px)} onReset={() => onFlag(state.nation, null)} /> : null}
        </>
      ) : null}
      <div class="panel-sub">{t('editor.import')}</div>
      <div class="god-row">
        <select data-testid="editor-import-layer" value={importLayer} onChange={(e) => setImportLayer((e.currentTarget as HTMLSelectElement).value as 'terrain' | 'nation')}>
          <option value="terrain">{t('editor.import.terrain')}</option>
          <option value="nation">{t('editor.import.nation')}</option>
        </select>
        <input
          data-testid="editor-import-file"
          type="file"
          accept="image/*"
          aria-label={t('editor.import')}
          onChange={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            const f = input.files?.[0];
            if (f) onImport(f, importLayer);
            input.value = '';
          }}
        />
      </div>
      <div class="panel-sub">{t('scenario.file')}</div>
      <div class="god-row">
        <input data-testid="scenario-name" placeholder={t('scenario.name')} value={scenarioName} onInput={(e) => setScenarioName((e.currentTarget as HTMLInputElement).value)} />
        <button type="button" class="god-btn" data-testid="scenario-export" onClick={() => onExportScenario(scenarioName)}>
          {t('scenario.export')}
        </button>
      </div>
      <div class="god-row">
        <span>{t('scenario.import')}</span>
        <input
          data-testid="scenario-import"
          type="file"
          accept=".warism-scenario,.warsim-scenario"
          aria-label={t('scenario.import')}
          onChange={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            const f = input.files?.[0];
            if (f) onImportScenario(f);
            input.value = '';
          }}
        />
      </div>
      {scenarioStatus ? (
        <div class="panel-note" data-testid="scenario-status">
          {scenarioStatus}
        </div>
      ) : null}
      <div class="panel-note" data-testid="editor-hint">
        {t(state.tool === 'line' && lineStarted ? 'editor.hint.lineEnd' : (`editor.hint.${state.tool}` as MessageKey))}
      </div>
    </aside>
  );
}
