import type { World } from '../../src/sim/world';

/**
 * Wars inside one realm or one alliance (PLAN 3.8, the critic's R3-B4): one line for every pair
 * of nations at war that share an alliance or an overlord, where one is the other's puppet, or
 * where one or its overlord is the ally of the other or of its overlord. Empty in a world whose
 * rules alone have made its wars.
 */
export function realmWars(world: World, tag: (n: number) => string = (n) => `nation ${n}`): string[] {
  const nc = world.nations.cols;
  const al = world.alliances;
  const realm = (n: number): number => nc.overlord[n] || n;
  const out = new Set<string>();
  for (const war of world.wars.list) {
    for (const a of war.sides[0]) {
      for (const d of war.sides[1]) {
        const [ra, rd] = [realm(a), realm(d)];
        const why = ra === rd ? 'one realm' : al.allied(a, d) ? 'allies' : al.allied(ra, rd) || al.allied(a, rd) || al.allied(ra, d) ? 'allied realms' : '';
        if (why) out.add(`war ${war.id}: ${tag(a)} (of ${tag(ra)}) × ${tag(d)} (of ${tag(rd)}): ${why}`);
      }
    }
  }
  return [...out];
}
