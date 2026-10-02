// Types shared by the benchmark pages and tools/bench/run.ts.

export interface FrameStats {
  frames: number;
  seconds: number;
  fps: number;
  frameMsP50: number;
  frameMsP95: number;
}

export interface BenchAResult {
  renderer: string;
  viewport: [number, number];
  dpr: number;
  map: [number, number];
  nations: number;
  genMs: number;
  uploadMs: number;
  /** GPU ms per full-screen map draw (EXT_disjoint_timer_query_webgl2). */
  drawMs: Record<string, number>;
  /** rAF frame stats at T0 world view. */
  t0: FrameStats;
  /** rAF frame stats while uploading 32 dirty 64×64 tiles per frame. */
  t0TileChurn: FrameStats & { tilesPerFrame: number };
}

export interface BenchApi {
  ready: Promise<void>;
  run: () => Promise<unknown>;
  setCamera: (cx: number, cy: number, scale: number) => Promise<void>;
}

declare global {
  interface Window {
    __bench?: BenchApi;
  }
}
