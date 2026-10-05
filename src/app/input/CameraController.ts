/**
 * Camera input (AoC parity rows "Camera controls"): mouse drag (left/middle/right), wheel zoom
 * anchored at the cursor, keyboard pan (arrows/WASD) and zoom (Q/E, +/−, numpad), touch drag
 * and two-finger pinch. Zoom is continuous and eased toward a target; pans are immediate.
 * `flyTo` is the one eased pan: a flight to a place (PLAN 2.14f5b4), which any input of the
 * user's ends where it is.
 * While a paint tool has the primary button (`leftPans` false, PLAN 1.44), the left button and
 * one finger do not pan: the middle and right buttons, two fingers and the keys still do.
 */
import {
  flight,
  normalize,
  panBy,
  zoomAt,
  type Camera,
  type Flight,
  type MapGeometry,
} from '../../render/camera';

/** Screen px per second for keyboard panning. */
const KEY_PAN_PX_S = 900;
/** Zoom factor per second while a zoom key is held. */
const KEY_ZOOM_PER_S = 3;
/** Wheel: zoom factor per 100 px of deltaY (pixel mode). */
const WHEEL_ZOOM_PER_100 = 1.25;
/** Exponential easing rate (1/s) toward the zoom target. */
const ZOOM_EASE = 18;

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
};
const ZOOM_IN_KEYS = new Set(['KeyE', 'Equal', 'NumpadAdd']);
const ZOOM_OUT_KEYS = new Set(['KeyQ', 'Minus', 'NumpadSubtract']);

export class CameraController {
  cam: Camera;
  /** Target scale and its screen anchor; the camera eases toward it. */
  private targetScale: number;
  private anchor: [number, number];
  private readonly keys = new Set<string>();
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly touches = new Map<number, [number, number]>();
  private pinch: { dist: number; mid: [number, number] } | null = null;
  /** The flight under way and the seconds of it flown. */
  private flying: { path: Flight; t: number } | null = null;
  private readonly detach: (() => void)[] = [];
  /** False while something else uses a primary-button drag (the editor's brush and line). */
  leftPans: () => boolean = () => true;

  constructor(
    private readonly el: HTMLElement,
    private readonly geo: MapGeometry,
    initial: Camera,
  ) {
    this.cam = normalize(initial, geo, el.clientWidth, el.clientHeight);
    this.targetScale = this.cam.scale;
    this.anchor = [el.clientWidth / 2, el.clientHeight / 2];
    this.listen(el, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.listen(el, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(window, 'pointercancel', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(window, 'blur', () => this.keys.clear());
    this.listen(el, 'contextmenu', (e) => e.preventDefault());
    el.style.touchAction = 'none';
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.detach.push(() => target.removeEventListener(type, fn, opts));
  }

  dispose(): void {
    for (const d of this.detach) d();
  }

  private get viewW(): number {
    return this.el.clientWidth;
  }

  private get viewH(): number {
    return this.el.clientHeight;
  }

  /** Jumps immediately (test API, God tools). */
  set(cam: Camera): void {
    this.flying = null;
    this.cam = normalize(cam, this.geo, this.viewW, this.viewH);
    this.targetScale = this.cam.scale;
  }

  /** Flies to `cam`: pan and zoom in one eased movement (`flight`), ending on it exactly. */
  flyTo(cam: Camera): void {
    const to = normalize(cam, this.geo, this.viewW, this.viewH);
    this.flying = { path: flight(this.cam, to, this.geo, this.viewW), t: 0 };
    this.targetScale = this.cam.scale;
  }

  /** Ends a flight where it is: the user has taken the camera. */
  private land(): void {
    if (!this.flying) return;
    this.flying = null;
    this.targetScale = this.cam.scale;
  }

  /** Eased zoom toward `scale`, anchored at a screen point (default: centre). */
  zoomTo(scale: number, anchor?: [number, number]): void {
    this.land();
    const n = normalize({ ...this.cam, scale }, this.geo, this.viewW, this.viewH);
    this.targetScale = n.scale;
    this.anchor = anchor ?? [this.viewW / 2, this.viewH / 2];
  }

  /** True while an animation or held key still changes the camera. */
  get animating(): boolean {
    return this.flying !== null || this.keys.size > 0 || Math.abs(Math.log(this.targetScale / this.cam.scale)) > 1e-4;
  }

  /** Per-frame update: held keys and zoom easing. `dt` in seconds. */
  update(dt: number): void {
    if (this.flying && this.keys.size > 0) this.land();
    if (this.flying) {
      const f = this.flying;
      f.t += Math.max(0, dt);
      const part = f.t / (f.path.ms / 1000);
      this.cam = normalize(f.path.at(part), this.geo, this.viewW, this.viewH);
      this.targetScale = this.cam.scale;
      if (part >= 1) this.flying = null;
      return;
    }
    let dx = 0;
    let dy = 0;
    let zoom = 0;
    for (const k of this.keys) {
      const p = PAN_KEYS[k];
      if (p) {
        dx += p[0];
        dy += p[1];
      }
      if (ZOOM_IN_KEYS.has(k)) zoom += 1;
      if (ZOOM_OUT_KEYS.has(k)) zoom -= 1;
    }
    let cam = this.cam;
    if (dx !== 0 || dy !== 0) cam = panBy(cam, -dx * KEY_PAN_PX_S * dt, -dy * KEY_PAN_PX_S * dt);
    if (zoom !== 0) {
      this.targetScale *= Math.pow(KEY_ZOOM_PER_S, zoom * dt);
      this.anchor = [this.viewW / 2, this.viewH / 2];
    }
    this.targetScale = normalize({ ...cam, scale: this.targetScale }, this.geo, this.viewW, this.viewH).scale;
    const ratio = this.targetScale / cam.scale;
    if (Math.abs(Math.log(ratio)) > 1e-4) {
      const step = Math.pow(ratio, 1 - Math.exp(-ZOOM_EASE * dt));
      cam = zoomAt(cam, step, this.anchor[0], this.anchor[1], this.viewW, this.viewH);
    } else if (ratio !== 1) {
      cam = zoomAt(cam, ratio, this.anchor[0], this.anchor[1], this.viewW, this.viewH);
    }
    this.cam = normalize(cam, this.geo, this.viewW, this.viewH);
  }

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.land();
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    this.targetScale *= Math.pow(WHEEL_ZOOM_PER_100, -px / 100);
    this.anchor = this.local(e);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.land();
      this.touches.set(e.pointerId, this.local(e));
      this.startPinchIfTwo();
      return;
    }
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    if (e.button === 0 && !this.leftPans()) return;
    e.preventDefault();
    this.land();
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.el.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      const prev = this.touches.get(e.pointerId)!;
      const cur = this.local(e);
      this.touches.set(e.pointerId, cur);
      if (this.touches.size === 1) {
        if (this.leftPans()) this.cam = normalize(panBy(this.cam, cur[0] - prev[0], cur[1] - prev[1]), this.geo, this.viewW, this.viewH);
      } else if (this.touches.size === 2 && this.pinch) {
        const [a, b] = [...this.touches.values()] as [[number, number], [number, number]];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        let cam = panBy(this.cam, mid[0] - this.pinch.mid[0], mid[1] - this.pinch.mid[1]);
        cam = zoomAt(cam, dist / this.pinch.dist, mid[0], mid[1], this.viewW, this.viewH);
        this.cam = normalize(cam, this.geo, this.viewW, this.viewH);
        this.targetScale = this.cam.scale;
        this.pinch = { dist, mid };
      }
      return;
    }
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    this.cam = normalize(panBy(this.cam, dx, dy), this.geo, this.viewW, this.viewH);
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.touches.delete(e.pointerId)) {
      this.pinch = null;
      this.startPinchIfTwo();
    }
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  }

  private startPinchIfTwo(): void {
    if (this.touches.size !== 2) return;
    const [a, b] = [...this.touches.values()] as [[number, number], [number, number]];
    this.pinch = { dist: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!(e.code in PAN_KEYS) && !ZOOM_IN_KEYS.has(e.code) && !ZOOM_OUT_KEYS.has(e.code)) return;
    if (down) {
      this.keys.add(e.code);
      e.preventDefault();
    } else this.keys.delete(e.code);
  }
}
