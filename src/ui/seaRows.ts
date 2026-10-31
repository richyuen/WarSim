/** A sea row of the ticker (PLAN 4.10b): a battle, a carrier's strike, or fleets closing. */
export interface SeaRow {
  key: string;
  text: string;
  kind?: 'pair' | 'strike' | 'raid' | 'closing';
}

/**
 * The ticker's sea rows with the same kind and words told once, with how many (PLAN 7.167; critic
 * runs 20–21: three rows of "Carrier strike ashore: United States on Greece", one carrier group's
 * fleets each striking). Each kept where its first stood, with that one's key: a click flies there.
 */
export function mergeSeaRows<R extends SeaRow>(rows: readonly R[]): (R & { count: number })[] {
  const out: (R & { count: number })[] = [];
  const at = new Map<string, number>();
  for (const r of rows) {
    const id = `${r.kind ?? ''}\u0000${r.text}`;
    const i = at.get(id);
    if (i === undefined) {
      at.set(id, out.length);
      out.push({ ...r, count: 1 });
    } else out[i]!.count++;
  }
  return out;
}
