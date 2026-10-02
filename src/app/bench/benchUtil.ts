// Frame-timing helpers shared by the benchmark pages.
import type { FrameStats } from './benchApi';

export function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
}

/**
 * Runs `frame(now)` from rAF for `seconds` and reports rAF interval stats plus the CPU time
 * spent inside `frame` (JS + GL command submission; GPU time is measured separately).
 */
export function runFrames(seconds: number, frame: (now: number) => void): Promise<FrameStats & { cpuMsP50: number; cpuMsP95: number }> {
  return new Promise((resolve) => {
    const times: number[] = [];
    const cpu: number[] = [];
    let last = -1;
    const start = performance.now();
    const loop = (now: number): void => {
      const c0 = performance.now();
      frame(now);
      cpu.push(performance.now() - c0);
      if (last >= 0) times.push(now - last);
      last = now;
      if (now - start < seconds * 1000) requestAnimationFrame(loop);
      else {
        const total = times.reduce((a, b) => a + b, 0) / 1000;
        resolve({
          frames: times.length,
          seconds: total,
          fps: times.length / total,
          frameMsP50: percentile(times, 0.5),
          frameMsP95: percentile(times, 0.95),
          cpuMsP50: percentile(cpu, 0.5),
          cpuMsP95: percentile(cpu, 0.95),
        });
      }
    };
    requestAnimationFrame(loop);
  });
}
