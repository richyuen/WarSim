/**
 * GPU timing via EXT_disjoint_timer_query_webgl2 (used by benchmarks and the dev overlay).
 * `gl.finish()` does not wait for the GPU under ANGLE, so CPU timing of draws is meaningless.
 */

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  private readonly ext: TimerExt | null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
  }

  get available(): boolean {
    return this.ext !== null;
  }

  /**
   * Runs `draw` n times inside one TIME_ELAPSED query and resolves with GPU ms per call,
   * or NaN when timer queries are unavailable or the measurement was disjoint.
   */
  async measure(draw: () => void, n: number): Promise<number> {
    const gl = this.gl;
    const ext = this.ext;
    if (!ext) return NaN;
    const q = gl.createQuery()!;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    for (let i = 0; i < n; i++) draw();
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    gl.flush();
    for (let tries = 0; tries < 600; tries++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean) {
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
        gl.deleteQuery(q);
        return disjoint ? NaN : ns / 1e6 / n;
      }
    }
    gl.deleteQuery(q);
    return NaN;
  }
}
