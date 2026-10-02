export function count(o: Record<string, number>): number {
  let n = 0;
  for (const k in o) n += o[k] ?? 0;
  return n;
}
