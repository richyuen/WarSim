// Benchmark page entry (bench.html?b=A|B…): loads one benchmark module, see tools/bench/run.ts.
const which = new URLSearchParams(location.search).get('b') ?? 'A';
const loaders: Record<string, () => Promise<unknown>> = {
  A: () => import('./benchA'),
};
const load = loaders[which];
if (!load) throw new Error(`unknown benchmark ${which}`);
await load();
export {};
