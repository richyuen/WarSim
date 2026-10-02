// `npm run bench [-- A B …]`: builds, serves the production bundle and runs the render
// benchmarks in Chromium on the real GPU (ANGLE/D3D11 on Windows; headless still uses the
// GPU with these flags). Results → docs/bench/<name>.json, screenshots → docs/bench/*.png.
import { chromium, type Page } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/bench/benchApi';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'docs/bench');
const PORT = 4174;
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'];

interface Shot {
  name: string;
  cx: number;
  cy: number;
  scale: number;
}

interface BenchSpec {
  id: string;
  file: string;
  shots: Shot[];
}

const BENCHES: Record<string, BenchSpec> = {
  A: {
    id: 'A',
    file: 'A-webgl2-map',
    shots: [
      { name: 'z0-world', cx: 1024, cy: 512, scale: 0.9 },
      { name: 'z1-region', cx: 1100, cy: 330, scale: 6 },
      { name: 'z2-close', cx: 1100.3, cy: 330.7, scale: 48 },
    ],
  },
  B: {
    id: 'B',
    file: 'B-webgl2-proxies',
    shots: [
      { name: 'tactical', cx: 1100, cy: 330, scale: 24 },
      { name: 'close', cx: 1100, cy: 330, scale: 96 },
    ],
  },
  BP: { id: 'BP', file: 'BP-pixi-proxies', shots: [{ name: 'tactical', cx: 1100, cy: 330, scale: 24 }] },
  // Province raster (PLAN 0.19): world, Europe, Britain (London boroughs are forced placements).
  R: {
    id: 'R',
    file: 'R-provinces-M',
    shots: [
      { name: 'world', cx: 1024, cy: 512, scale: 0.9 },
      { name: 'europe', cx: 1109, cy: 286, scale: 5 },
      { name: 'britain', cx: 1020, cy: 268, scale: 22 },
    ],
  },
};

async function waitForServer(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start: ${url}`);
}

async function runOne(page: Page, spec: BenchSpec): Promise<unknown> {
  await page.goto(`http://127.0.0.1:${PORT}/bench.html?b=${spec.id}`);
  await page.waitForFunction(() => window.__bench !== undefined, null, { timeout: 60_000 });
  const result = await page.evaluate(() => window.__bench!.run());
  for (const s of spec.shots) {
    await page.evaluate(({ cx, cy, scale }) => window.__bench!.setCamera(cx, cy, scale), s);
    await page.screenshot({ path: path.join(outDir, `${spec.file}-${s.name}.png`) });
  }
  return result;
}

async function main(): Promise<void> {
  const which = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const specs = (which.length ? which : Object.keys(BENCHES)).map((k) => {
    const s = BENCHES[k];
    if (!s) throw new Error(`unknown bench ${k}`);
    return s;
  });
  mkdirSync(outDir, { recursive: true });
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  // One command string (no args array) with shell: true avoids Node's DEP0190 warning.
  const server: ChildProcess = spawn(`npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`, {
    cwd: root,
    shell: true,
    stdio: 'ignore',
  });
  try {
    await waitForServer(`http://127.0.0.1:${PORT}/bench.html`, 30_000);
    const browser = await chromium.launch({ args: GPU_ARGS });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
    page.on('pageerror', (e) => console.error('[page]', e.message));
    for (const spec of specs) {
      const result = await runOne(page, spec);
      const record = { bench: spec.id, date: new Date().toISOString(), result };
      writeFileSync(path.join(outDir, `${spec.file}.json`), `${JSON.stringify(record, null, 2)}\n`);
      console.log(JSON.stringify(record, null, 2));
    }
    await browser.close();
  } finally {
    server.kill();
    if (process.platform === 'win32' && server.pid) {
      try {
        execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        /* already gone */
      }
    }
  }
}

await main();
