/**
 * `npm run sim -- … --affinity <mask>`: confines the run to the logical CPUs of `mask`, at high
 * priority, so a tick timing does not depend on where the scheduler puts the process. On a
 * processor with performance and efficiency cores the same commit measured 1.68 and 2.76 ms a
 * tick minutes apart, the machine idle both times (PROGRESS 2026-10-03, PLAN 1.42e1). The
 * performance cores of the machine the tick budget was set on are 0xFFFF.
 */
import { execFileSync } from 'node:child_process';

/** The CPU mask of an `--affinity` value: a positive integer, decimal or 0x hex. */
export function parseAffinity(text: string): number {
  const mask = Number(text);
  if (text.trim() === '' || !Number.isSafeInteger(mask) || mask <= 0) throw new Error(`--affinity takes a CPU mask such as 0xFFFF, not '${text}'`);
  return mask;
}

/** Confines this process (all its threads) to the CPUs of `mask`; on Windows also raises its priority. */
export function pinProcess(mask: number): void {
  const quiet = { stdio: ['ignore', 'ignore', 'inherit'] as ['ignore', 'ignore', 'inherit'] };
  if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command', `$p = Get-Process -Id ${process.pid}; $p.ProcessorAffinity = [IntPtr][int64]${mask}; $p.PriorityClass = 'High'`], quiet);
  } else if (process.platform === 'linux') {
    execFileSync('taskset', ['-a', '-p', mask.toString(16), String(process.pid)], quiet);
  } else {
    throw new Error(`--affinity is not supported on ${process.platform}`);
  }
}
