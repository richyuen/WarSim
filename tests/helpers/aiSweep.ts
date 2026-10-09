import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { isDayStart, isMonthStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import type { HistoryRow } from '../../src/shared/history';
import { FLAG_H, FLAG_W, foundedFlag, specToPixels } from '../../src/shared/flagPixels';
import { foundedName, foundedNth, provinceLabel } from '../../src/shared/nationNames';
import { NATIONS_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { historyText } from '../../src/ui/historyText';
import { historyRows } from '../../src/worker/historyRows';
import { deadLand } from './deadLand';
import { homeWait } from './homeWait';
import { assets1938, earthAdmin1 } from './earth';
import { realmWars } from './realmWars';
import { revoltLand } from './revoltLand';
import { strayNaN } from './stateNumbers';

/**
 * PLAN 1.24 AT: a 10-year 1938 run on `seed` has ≥ 3 wars, ≥ 1 peace, ≥ 1 alliance change; and,
 * at every year end, no two members of one alliance are at war.
 *
 * PLAN 3.8 AT (the critic's R3-B4): on every day of those years no two nations at war share an
 * alliance or an overlord, nor are they of allied realms (`realmWars`).
 *
 * PLAN 3.9 AT (the critic's R3-B2): no revolt of a month's first hour hands a nation more land
 * than a region may hold (`revoltLand`).
 *
 * PLAN 3.12 AT (the critic's R3-B6): no row of the history of those years shows an id ("#43
 * dissolved", "Denmark left #43"), and every row of an alliance names it.
 *
 * PLAN 3.12b: a revolt's row says which of three things it was. What the state showed as the
 * hour began (was the nation alive?) and the hour's `NationRevived` are kept here, and the row
 * the worker makes from the log alone must agree: "broke away" is only of a nation founded.
 *
 * PLAN 3.12Rh3 AT: on every day no two living nations have one name ("Free Damascus declared
 * war on Free Damascus"), and no war has a nation on both sides.
 *
 * PLAN 3.12Rk AT: no formation that bears the mark of a march home stands before an enemy's
 * cell for 30 days (`homeWait`).
 *
 * PLAN 3.12Rm AT: on every day no formation is in a cell no route enters (a cell of component 0
 * of the grid: water), where it could take no order.
 *
 * PLAN 3.12Rn AT: every war that leaves `wars.list` has its end in the log of that hour: a peace
 * or a `WarEnded` between a nation of each side, or the death of one of its nations (a war whose
 * last nation of a side died is ended by that death's row). And every war declared is one of
 * those or in the list still.
 *
 * PLAN 2.15 AT (the critic's R2-B6): every nation founded in those years has an origin, a name
 * that is not "Free state N", and a flag of two colours or more with its own colour on it.
 */
export function aiSweep(seed: number): void {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  const counts: Record<string, number> = {};
  const names = Object.fromEntries(Object.entries(EventKind).map(([k, v]) => [v, k]));
  const yearly: Record<string, number>[] = [];
  const t0 = performance.now();
  const tag = (n: number): string => TAGS_1938[n - 1] ?? `nation ${n}`;
  // The game as it is saved at the end of year 9 (PLAN 2.12): loaded below, it must end year 10
  // as this game does.
  let saved: Uint8Array | null = null;
  // The owners as the last tick ended, kept around each month's first hour (PLAN 3.9).
  let owners: Uint16Array | null = null;
  let ownersAt = -1;
  let revoltsSeen = 0;
  // PLAN 3.12b: what each revolt's row is of, by the state: the nations alive as the hour began.
  const nations = s.world.nations;
  const alive = new Set<number>();
  nations.forEach((n) => void (nations.cols.living[n] === 1 && alive.add(n)));
  const revoltsAs: string[] = [];
  // PLAN 3.12b2: the land that went over, one line for two nations in an hour, and whether its
  // holder was dead as the hour ended.
  const cededAs: string[] = [];
  let cededEvents = 0;
  // PLAN 3.12Rh3: the names as the worker gives them (`SimServer.nameOf`), in English.
  const labels = earthAdmin1().meta.map(provinceLabel);
  const en = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/i18n/en.json'), 'utf8')) as Record<string, string>;
  const nameOf = (id: number, nth = foundedNth(id, nations.cols.origin, labels)): string => {
    const key = NATIONS_1938[id - 1]?.nameKey;
    return key !== undefined ? en[key]! : foundedName(id, nations.cols.origin[id]!, labels, nth);
  };
  // The days on which two living nations were called after one province, and the most at once.
  let namesakeDays = 0;
  const waits = homeWait();
  let formationDays = 0;
  let namesakesMost = 0;
  // PLAN 3.12Rn: the wars as the hour before ended, by id, and how each that is gone ended.
  const open = new Map<number, [number[], number[]]>();
  for (const war of s.world.wars.list) open.set(war.id, [[...war.sides[0]], [...war.sides[1]]]);
  const begun = open.size;
  const endedBy = { peace: 0, bond: 0, death: 0 };
  // The wars declared and gone within one hour, which no hour's end saw, and the next war's id.
  let short = 0;
  const shortAt: string[] = [];
  let shortDead = 0;
  let nextWar = s.world.wars.nextId;
  for (let y = 0; y < 10; y++) {
    if (y === 9) saved = s.save();
    const year: Record<string, number> = {};
    s.step(24 * 365, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        const k = names[ev[i + 1]!]!;
        counts[k] = (counts[k] ?? 0) + 1;
        year[k] = (year[k] ?? 0) + 1;
        if (ev[i + 1] === EventKind.LandCeded) {
          cededEvents++;
          const [to, from] = [ev[i + 2]!, ev[i + 3]!];
          const line = `${ev[i]!} ${to} ${from} ${w.nations.cols.living[from] === 1 ? 'back' : 'left'}`;
          if (!cededAs.includes(line)) cededAs.push(line);
        }
        if (ev[i + 1] !== EventKind.RevoltSpawned) continue;
        const a = ev[i + 2]!;
        const back = ev.some((v, j) => j % 6 === 1 && v === EventKind.NationRevived && ev[j + 1] === a);
        revoltsAs.push(`${ev[i]!} ${a} ${ev[i + 3]!} ${back ? 'revived' : alive.has(a) ? 'joined' : 'founded'}`);
        alive.add(a); // an area that rises later in this hour rises to it
      }
      // PLAN 3.12Rn: a war that is gone has its end among the hour's events.
      if (open.size !== w.wars.list.length || w.wars.nextId !== nextWar || w.wars.list.some((war) => !open.has(war.id))) {
        const now = new Set(w.wars.list.map((war) => war.id));
        const is = (i: number, kind: number): boolean => i % 6 === 1 && ev[i] === kind;
        // A war declared in this hour that is gone: its declaration, and after it a peace or a
        // `WarEnded` of the two it names, or the death of one of them.
        const declared: number[] = [];
        for (let id = nextWar; id < w.wars.nextId; id++) {
          if (now.has(id)) continue;
          short++;
          let how: 'peace' | 'bond' | 'death' | null = null;
          let dead = 0;
          for (let i = 0; i < ev.length && how === null; i++) {
            if (!is(i, EventKind.WarDeclared) || declared.includes(i)) continue;
            const [a, b] = [ev[i + 1]!, ev[i + 2]!];
            const of = (j: number): boolean => (ev[j + 1] === a && ev[j + 2] === b) || (ev[j + 1] === b && ev[j + 2] === a);
            for (let j = i + 6; j < ev.length && how === null; j += 6) how = is(j, EventKind.PeaceSigned) && of(j) ? 'peace' : is(j, EventKind.WarEnded) && of(j) ? 'bond' : is(j, EventKind.NationEliminated) && (ev[j + 1] === a || ev[j + 1] === b) ? 'death' : null;
            if (how !== null) declared.push(i);
            if (how === 'death') dead = w.nations.cols.living[a] === 1 ? b : a;
          }
          expect(how, `seed ${seed}, tick ${w.tick}: war ${id}, declared in this hour, is gone with no end in the log`).not.toBeNull();
          endedBy[how!]++;
          // PLAN 3.12Rr: its own peace, or a bond, ended none in its hour. One whose nation died
          // in the hour is not that when the nation was at war before it: an older war took it
          // (seed 3, tick 30,817; PLAN 3.12Rr3).
          const older = dead !== 0 && [...open.values()].some(([A, D]) => A.includes(dead) || D.includes(dead));
          if (older) shortDead++;
          else shortAt.push(`tick ${w.tick}: war ${id}, ended by a ${how!}`);
        }
        nextWar = w.wars.nextId;
        for (const [id, [A, D]] of open) {
          if (now.has(id)) continue;
          const between = (kind: number): boolean => ev.some((k, i) => i % 6 === 1 && k === kind && ((A.includes(ev[i + 1]!) && D.includes(ev[i + 2]!)) || (D.includes(ev[i + 1]!) && A.includes(ev[i + 2]!))));
          const how = between(EventKind.PeaceSigned) ? 'peace' : between(EventKind.WarEnded) ? 'bond' : ev.some((k, i) => i % 6 === 1 && k === EventKind.NationEliminated && (A.includes(ev[i + 1]!) || D.includes(ev[i + 1]!))) ? 'death' : null;
          expect(how, `seed ${seed}, tick ${w.tick}: war ${id} of ${A.map(tag).join(', ')} on ${D.map(tag).join(', ')} is gone with no end in the log`).not.toBeNull();
          endedBy[how!]++;
        }
      }
      open.clear();
      for (const war of w.wars.list) open.set(war.id, [[...war.sides[0]], [...war.sides[1]]]);
      if (ev.length > 0) {
        alive.clear();
        w.nations.forEach((n) => void (w.nations.cols.living[n] === 1 && alive.add(n)));
      }
      // PLAN 3.9: what the month's revolts handed over, against the owners of the tick before.
      if (owners && ownersAt === w.tick - 1 && ev.some((k, i) => i % 6 === 1 && k === EventKind.RevoltSpawned)) {
        revoltsSeen++;
        expect(revoltLand(w, owners, ev, tag), `seed ${seed}, tick ${w.tick}: a revolt's land`).toEqual([]);
      }
      if (isMonthStart(w.startDay, w.tick) || isMonthStart(w.startDay, w.tick + 1)) {
        owners = w.cells.owner.slice();
        ownersAt = w.tick;
      }
      ev.length = 0;
      w.out.fires.length = 0;
      waits.hour(w);
      // PLAN 3.8: on every day no two nations of one realm or of allied realms are at war.
      if (isDayStart(w.tick)) expect(realmWars(w, tag), `seed ${seed}, day ${w.tick / 24}: wars inside a realm or an alliance`).toEqual([]);
      // PLAN 3.12Rm: on every day every formation is in a cell a route begins in.
      if (isDayStart(w.tick)) {
        const fc = w.formations.cols;
        const comp = navOf(w).grid.component;
        const closed: string[] = [];
        w.formations.forEach((f) => {
          formationDays++;
          if (comp[Math.floor(fc.y[f]!) * w.cells.w + Math.floor(fc.x[f]!)] === 0) closed.push(`formation ${f} of ${tag(fc.nation[f]!)} at (${fc.x[f]!.toFixed(3)}, ${fc.y[f]!.toFixed(3)})`);
        });
        expect(closed, `seed ${seed}, day ${w.tick / 24}: formations in a cell no route enters`).toEqual([]);
      }
      if (isDayStart(w.tick)) {
        const holders = new Map<string, number>();
        const twice: string[] = [];
        const plain = new Set<string>();
        let living = 0;
        nations.forEach((n) => {
          if (nations.cols.living[n] !== 1) return;
          living++;
          plain.add(nameOf(n, 1));
          const name = nameOf(n);
          if (holders.has(name)) twice.push(`"${name}": nations ${holders.get(name)!} and ${n}`);
          else holders.set(name, n);
        });
        expect(twice, `seed ${seed}, day ${w.tick / 24}: two living nations of one name`).toEqual([]);
        if (plain.size < living) namesakeDays++;
        namesakesMost = Math.max(namesakesMost, living - plain.size);
        for (const war of w.wars.list) expect(war.sides[0].filter((n) => war.sides[1].includes(n)), `seed ${seed}, day ${w.tick / 24}: war ${war.id}, nations on both sides`).toEqual([]);
      }
      // PLAN 2.16Rf: at every month's end no cell has a dead nation as its owner or its controller.
      if (isMonthStart(w.startDay, w.tick)) expect(deadLand(w), `seed ${seed}, tick ${w.tick}: land of the dead`).toEqual([]);
    });
    yearly.push(year);
    // Invariant (review in PLAN 1.34a): no alliance has two members at war with each other.
    for (const al of s.world.alliances.list) {
      for (const m of al.members) for (const o of al.members) if (m < o) expect(s.world.wars.atWar(m, o), `seed ${seed} year ${y}: allies ${m} and ${o} at war`).toBe(false);
    }
  }
  // A loaded game goes on as the game that was saved, late in a game too (PLAN 2.12, the
  // critic's R2-B4: its tables are as long as the save, where this game's have doubled; a
  // nation founded as a table grew was lost, and the two games lost different nations).
  const loaded = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  loaded.load(saved!);
  loaded.step(24 * 365);
  expect(loaded.hash(), `seed ${seed}: the game saved at the end of year 9 and loaded, at the end of year 10 (nations up to ${s.world.nations.highWater - 1})`).toBe(s.hash());
  // And after ten years no number of the state is a NaN out of arithmetic (see `strayNaN`).
  expect(strayNaN(s.world), `seed ${seed}: NaN in the state after ten years`).toEqual([]);
  // The nations the game founded (PLAN 2.15): each has a name and a flag. The flag is the one the
  // view draws: a function of the id and the colour (ADR-101).
  const nc = s.world.nations.cols;
  let founded = 0;
  for (let id = NATIONS_1938.length + 1; id < s.world.nations.highWater; id++) {
    founded++;
    const origin = nc.origin[id]!;
    expect(origin, `seed ${seed}, nation ${id}: an origin`).toBeGreaterThan(0);
    expect(foundedName(id, origin, labels), `seed ${seed}, nation ${id}, origin ${origin}`).not.toMatch(/^Free state \d+$/);
    const n = new Map<number, number>();
    for (const v of specToPixels(foundedFlag(id, nc.color[id]!), {})) n.set(v, (n.get(v) ?? 0) + 1);
    const colours = [...n].filter(([, k]) => k >= (FLAG_W * FLAG_H) / 20).map(([c]) => c);
    expect(colours.length, `seed ${seed}, nation ${id}: the colours of its flag`).toBeGreaterThanOrEqual(2);
    expect(colours, `seed ${seed}, nation ${id}: its colour on its flag`).toContain(nc.color[id]!);
  }
  expect(founded, `seed ${seed}: nations founded in ten years`).toBeGreaterThan(0);
  process.stderr.write(`seed ${seed}: ${namesakeDays} days with living nations called after one province (${namesakesMost} more nations than provinces at most), each with a name of its own
`);
  expect(revoltsSeen, `seed ${seed}: months whose revolts were measured`).toBeGreaterThan(0);
  process.stderr.write(`seed ${seed}: ${formationDays} formation-days, none in a cell no route enters
`);
  // PLAN 3.12Rk: no march home waits out a war before an enemy's cell.
  process.stderr.write(`seed ${seed}: ${waits.marked} formation-hours with the mark of a march home; the longest wait before an enemy's cell ${waits.longest} h${waits.where ? ` (${waits.where})` : ''}
`);
  expect(waits.marked, `seed ${seed}: formation-hours with the mark of a march home`).toBeGreaterThan(0);
  expect(waits.longest, `seed ${seed}: hours a marked formation stood before an enemy's cell (${waits.where})`).toBeLessThan(24 * 30);
  console.log(`seed ${seed}: ${founded} nations founded in ten years, each with a name and a flag`);
  // The history as the panel has it (PLAN 3.12a): no row shows an id, no alliance is unnamed.
  const rows = historyRows(s.world, (id) => NATIONS_1938[id - 1]?.nameKey ?? `=${nameOf(id)}`, (c) => `City ${String.fromCharCode(65 + (c % 26))}`);
  const ofAlliance: number[] = [EventKind.AllianceLeft, EventKind.AllianceDissolved, EventKind.AllianceJoined, EventKind.UnionFormed];
  let allianceRows = 0;
  // PLAN 3.12Rg1: the first row of an alliance, when it is its founder's, is its founding and no
  // other is (a scenario's alliance has no founding in the log: its first row is of another).
  const founderOf = new Map<number, number>([...s.world.alliances.past, ...s.world.alliances.list].map((a) => [a.id, a.founder]));
  const firstOf = new Map<number, HistoryRow>();
  for (const r of rows) {
    const id = r.kind === EventKind.AllianceJoined || r.kind === EventKind.AllianceLeft ? r.b : r.kind === EventKind.AllianceDissolved || r.kind === EventKind.UnionFormed ? r.a : 0;
    if (id !== 0 && !firstOf.has(id)) firstOf.set(id, r);
    if (r.kind !== EventKind.AllianceJoined) continue;
    expect(r.as, `seed ${seed}, tick ${r.tick}: "${historyText(r)}", the founder's first row of its alliance or not`).toBe(firstOf.get(id) === r && founderOf.get(id) === r.a ? 'founded' : undefined);
    expect(historyText(r), `seed ${seed}, tick ${r.tick}`).toMatch(r.as === 'founded' ? / founded (a|the) \S/ : / joined the \S/);
  }
  const foundings = rows.filter((r) => r.as === 'founded').length;
  expect(foundings, `seed ${seed}: alliances founded in ten years`).toBeGreaterThan(0);
  console.log(`seed ${seed}: ${foundings} alliances founded, each with one row of its founding`);
  for (const r of rows) {
    const text = historyText(r);
    expect(text, `seed ${seed}, tick ${r.tick}: a history row with an id`).not.toMatch(/#\d+/);
    if (!ofAlliance.includes(r.kind)) continue;
    allianceRows++;
    expect(text, `seed ${seed}, tick ${r.tick}: a row of an alliance without its name`).not.toMatch(/an alliance/i);
    expect(r.of, `seed ${seed}, tick ${r.tick}: "${text}", its founder`).not.toBe('');
  }
  expect(allianceRows, `seed ${seed}: history rows of alliances`).toBeGreaterThan(0);
  // PLAN 3.12Rf: every alliance that is gone has its row, a death's too (29 gone and 15 rows in seed 1).
  expect(rows.filter((r) => r.kind === EventKind.AllianceDissolved).map((r) => r.a), `seed ${seed}: the alliances the log says dissolved`).toEqual(s.world.alliances.past.map((a) => a.id));
  // PLAN 3.12b: each revolt's row is of what the state showed, and only a founding "broke away".
  const revoltRows = rows.filter((r) => r.kind === EventKind.RevoltSpawned);
  expect(revoltRows.map((r) => `${r.tick} ${r.a} ${r.b} ${r.as ?? 'founded'}`), `seed ${seed}: what the revolts' rows are of`).toEqual(revoltsAs);
  for (const r of revoltRows) expect(/ broke away from /.test(historyText(r)), `seed ${seed}, tick ${r.tick}: "${historyText(r)}" (${r.as ?? 'founded'})`).toBe(r.as === undefined);
  const of = (as: string): number => revoltsAs.filter((l) => l.endsWith(as)).length;
  for (const as of ['founded', 'joined']) expect(of(as), `seed ${seed}: revolts ${as}`).toBeGreaterThan(0);
  console.log(`seed ${seed}: ${revoltRows.length} revolts: ${of('founded')} founded, ${of('joined')} joined, ${of('revived')} revived`);
  console.log(`seed ${seed}: ${rows.length} history rows, ${allianceRows} of alliances (${rows.filter((r) => r.kind === EventKind.AllianceDissolved).length} dissolved), none with an id`);
  // PLAN 3.12b2: each row of land that went over is of what the state showed, an hour's rows of
  // two nations are one, and only the land of the dead was "left".
  const cededRows = rows.filter((r) => r.kind === EventKind.LandCeded);
  expect(cededRows.map((r) => `${r.tick} ${r.a} ${r.b} ${r.as ?? 'back'}`), `seed ${seed}: what the rows of land that went over are of`).toEqual(cededAs);
  for (const r of cededRows) expect(historyText(r), `seed ${seed}, tick ${r.tick} (${r.as ?? 'back'})`).toMatch(r.as === 'left' ? /^Land left by \S.* went to \S/ : /^Land held by \S.* rose and went back to \S/);
  const cededOf = (as: string): number => cededAs.filter((l) => l.endsWith(as)).length;
  for (const as of ['back', 'left']) expect(cededOf(as), `seed ${seed}: land that went over, ${as}`).toBeGreaterThan(0);
  expect(cededRows.length, `seed ${seed}: rows of land that went over, of ${cededEvents} events`).toBeLessThanOrEqual(cededEvents);
  console.log(`seed ${seed}: ${cededEvents} events of land that went over, ${cededRows.length} rows: ${cededOf('back')} back to its core nation, ${cededOf('left')} left by the dead`);
  const wars = counts['WarDeclared'] ?? 0;
  const peace = counts['PeaceSigned'] ?? 0;
  // PLAN 3.12Rn: every war declared has an end in the log or is in the list.
  process.stderr.write(`seed ${seed}: ${begun} wars at the start and ${wars} declared: ${endedBy.peace} ended by a peace, ${endedBy.bond} by a bond (${counts['WarEnded'] ?? 0} rows), ${endedBy.death} by a death, ${s.world.wars.list.length} go on; ${short} of those ended were declared in the hour of their end, ${shortDead} of them on or by a nation that an older war ended in that hour
`);
  // PLAN 3.12Rr: no war is declared and gone in one hour, but for the death of its nation in an older war.
  expect(shortAt, `seed ${seed}: wars declared and gone in one hour`).toEqual([]);
  expect(endedBy.peace + endedBy.bond + endedBy.death + s.world.wars.list.length, `seed ${seed}: the wars ended and those that go on, of ${begun} at the start and ${wars} declared`).toBe(begun + wars);
  expect(endedBy.peace, `seed ${seed}: wars ended by a peace, and the peaces of the log`).toBe(peace);
  expect(endedBy.bond, `seed ${seed}: wars ended by a bond, and their rows`).toBe(counts['WarEnded'] ?? 0);
  const alliance = (counts['AllianceJoined'] ?? 0) + (counts['AllianceLeft'] ?? 0) + (counts['AllianceDissolved'] ?? 0);
  if (process.env['EVIDENCE']) {
    const out = path.resolve(import.meta.dirname, '../../docs/evidence/1.24');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, `sweep-seed${seed}.json`), JSON.stringify({ seed, wallS: (performance.now() - t0) / 1000, totals: counts, yearly }, null, 1));
  }
  expect(wars, `seed ${seed} wars`).toBeGreaterThanOrEqual(3);
  expect(peace, `seed ${seed} peaces`).toBeGreaterThanOrEqual(1);
  expect(alliance, `seed ${seed} alliance changes`).toBeGreaterThanOrEqual(1);
}
