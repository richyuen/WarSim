// Benchmark page entry (bench.html?b=A|B…): loads one benchmark module, see tools/bench/run.ts.
const which = new URLSearchParams(location.search).get('b') ?? 'A';
const loaders: Record<string, () => Promise<unknown>> = {
  A: () => import('./benchA'),
  B: () => import('./benchB'),
  BP: () => import('./benchBP'),
  P: () => import('./precision'),
  R: () => import('./provincesView'),
  T: () => import('./terrainView'),
  W: () => import('./politicalView'),
};
const load = loaders[which];
if (!load) throw new Error(`unknown benchmark ${which}`);
await load();
export {};
