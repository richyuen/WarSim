import { useEffect, useRef, useState } from 'preact/hooks';
import { fillFlag, flagDisc, flagLine, FLAG_H, FLAG_PRESETS, FLAG_W, presetSpec, specToPixels, type FlagPreset } from '../shared/flagPixels';
import { t, type MessageKey } from './i18n';

const ZOOM = 7;
/** Steps the undo keeps (PLAN 7.4f8), as the map editor's. */
const UNDO_STEPS = 20;
type Tool = 'pencil' | 'bucket' | 'line' | 'circle' | 'pick';
const hex = (c: number): string => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
const rgbOf = (h: string): number => parseInt(h.slice(1), 16);

export interface FlagEditorProps {
  /** The flag to start from (copied). */
  initial: Uint32Array;
  onSave: (pixels: Uint32Array) => void;
  onReset: () => void;
}

/**
 * Flag editor (PLAN 1.37b): AoC-style 36×24 pixel flag. Pencil, bucket, line, circle and colour
 * picker on a zoomed grid (a line from where the button goes down to where it comes up; a circle
 * about where it goes down, out to where it comes up: PLAN 7.4f8, the critic's N13); undo of the
 * last 20 changes; presets (tricolours, crosses, saltire, canton, disc, star) in three colours.
 * Save sends the pixels as a `setFlag` command; Reset restores the scenario flag.
 */
export function FlagEditor({ initial, onSave, onReset }: FlagEditorProps) {
  const [px, setPx] = useState<Uint32Array>(() => initial.slice());
  const [tool, setTool] = useState<Tool>('pencil');
  const [undo, setUndo] = useState<Uint32Array[]>([]);
  /** Where a line or a circle began. */
  const from = useRef<[number, number] | null>(null);
  /** The pixels before a stroke of the pencil: one undo step for the stroke. */
  const before = useRef<Uint32Array | null>(null);
  const [color, setColor] = useState('#ffffff');
  const [preset, setPreset] = useState<FlagPreset>('tricolourH');
  const [c, setC] = useState(['#2e8b57', '#ffffff', '#c8102e']);
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);

  useEffect(() => {
    setPx(initial.slice());
    setUndo([]);
  }, [initial]);
  /** A change: the pixels before it go on the undo. */
  const change = (next: Uint32Array, prev: Uint32Array = px): void => {
    setUndo((u) => [...u.slice(-(UNDO_STEPS - 1)), prev]);
    setPx(next);
  };
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const img = new ImageData(FLAG_W, FLAG_H);
    for (let i = 0; i < px.length; i++) img.data.set([(px[i]! >> 16) & 255, (px[i]! >> 8) & 255, px[i]! & 255, 255], i * 4);
    ctx.putImageData(img, 0, 0);
  }, [px]);

  const at = (e: PointerEvent): [number, number] | null => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * FLAG_W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * FLAG_H);
    return x >= 0 && y >= 0 && x < FLAG_W && y < FLAG_H ? [x, y] : null;
  };
  const use = (e: PointerEvent): void => {
    const p = at(e);
    if (!p) return;
    const [x, y] = p;
    if (tool === 'pick') {
      setColor(hex(px[y * FLAG_W + x]!));
      return;
    }
    if (tool === 'line' || tool === 'circle') return;
    const next = px.slice();
    if (tool === 'bucket') {
      fillFlag(next, x, y, rgbOf(color));
      change(next);
    } else {
      next[y * FLAG_W + x] = rgbOf(color);
      setPx(next);
    }
  };
  /** The end of a line or a circle, where the button comes up. */
  const finish = (e: PointerEvent): void => {
    const a = from.current;
    from.current = null;
    const b = at(e);
    if (!a || !b) return;
    const next = px.slice();
    if (tool === 'line') flagLine(next, a[0], a[1], b[0], b[1], rgbOf(color));
    else flagDisc(next, a[0], a[1], Math.hypot(b[0] - a[0], b[1] - a[1]), rgbOf(color));
    change(next);
  };

  return (
    <div class="flag-editor" data-testid="flag-editor">
      <canvas
        ref={canvas}
        width={FLAG_W}
        height={FLAG_H}
        class="flag-canvas"
        style={{ width: `${FLAG_W * ZOOM}px`, height: `${FLAG_H * ZOOM}px` }}
        data-testid="flag-canvas"
        onPointerDown={(e) => {
          down.current = true;
          (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
          if (tool === 'line' || tool === 'circle') from.current = at(e);
          if (tool === 'pencil') before.current = px;
          use(e);
        }}
        onPointerMove={(e) => {
          if (down.current && tool === 'pencil') use(e);
        }}
        onPointerUp={(e) => {
          down.current = false;
          if (tool === 'line' || tool === 'circle') finish(e);
          if (tool === 'pencil' && before.current) {
            // The stroke is one step of the undo.
            const prev = before.current;
            before.current = null;
            setUndo((u) => [...u.slice(-(UNDO_STEPS - 1)), prev]);
          }
        }}
      />
      <div class="god-row">
        {(['pencil', 'bucket', 'line', 'circle', 'pick'] as const).map((k) => (
          <button key={k} type="button" class={tool === k ? 'god-btn active' : 'god-btn'} data-testid={`flag-tool-${k}`} onClick={() => setTool(k)}>
            {t(`flag.tool.${k}` as MessageKey)}
          </button>
        ))}
        <input type="color" data-testid="flag-color" value={color} aria-label={t('flag.color')} onInput={(e) => setColor((e.currentTarget as HTMLInputElement).value)} />
      </div>
      <div class="god-row">
        <select data-testid="flag-preset" value={preset} onChange={(e) => setPreset((e.currentTarget as HTMLSelectElement).value as FlagPreset)}>
          {FLAG_PRESETS.map((p) => (
            <option key={p} value={p}>
              {t(`flag.preset.${p}` as MessageKey)}
            </option>
          ))}
        </select>
        {c.map((v, i) => (
          <input key={i} type="color" data-testid={`flag-preset-c${i + 1}`} value={v} aria-label={t('flag.presetColor', { n: i + 1 })} onInput={(e) => setC(c.map((x, j) => (j === i ? (e.currentTarget as HTMLInputElement).value : x)))} />
        ))}
        <button type="button" class="god-btn" data-testid="flag-apply-preset" onClick={() => change(specToPixels(presetSpec(preset, rgbOf(c[0]!), rgbOf(c[1]!), rgbOf(c[2]!)), {}))}>
          {t('flag.applyPreset')}
        </button>
      </div>
      <div class="god-row">
        <button
          type="button"
          class="god-btn"
          data-testid="flag-undo"
          disabled={undo.length === 0}
          onClick={() => {
            setPx(undo[undo.length - 1]!);
            setUndo(undo.slice(0, -1));
          }}
        >
          {t('flag.undo')}
        </button>
        <button type="button" class="god-btn" data-testid="flag-save" onClick={() => onSave(px)}>
          {t('flag.save')}
        </button>
        <button type="button" class="god-btn" data-testid="flag-reset" onClick={onReset}>
          {t('flag.reset')}
        </button>
      </div>
    </div>
  );
}
