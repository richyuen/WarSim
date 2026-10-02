/**
 * zod schemas for every JSON file under `data/` (PLAN 1.1, SPEC §3).
 *
 * - Objects are strict: an unknown key (usually a typo) is an error, not silently ignored.
 * - `DATA_FILES` maps each `data/` path to its schema. A file that matches no pattern is an error,
 *   so new data cannot skip validation.
 * - `validateDataSet` runs the per-file schemas, then the cross-file checks that a single schema
 *   cannot express: unique ids, references (techReq, prereqs, map, size), the tech graph being
 *   acyclic, and the terrain table being in enum order.
 * - Errors read `<file>: <path>: <message>`, e.g. `units/land.json: types[2].stats.speed_kmh:
 *   Invalid input: expected number, received string`.
 */
import { z } from 'zod';
import { TERRAIN_IDS } from '../../shared/terrain';

// ── shared vocab ─────────────────────────────────────────────────────────────

/** Terrain classes in cell-layer enum order (SPEC §3.2): the array index is the u8 value. */
export { TERRAIN_IDS, type TerrainId } from '../../shared/terrain';

export const LAND_CLASSES = ['inf', 'art', 'at', 'aa', 'armor_l', 'armor_m', 'armor_h', 'mech', 'mot'] as const;
export const SEA_CLASSES = ['dd', 'cl', 'ca', 'bb', 'cv', 'ss', 'tp'] as const;
export const AIR_CLASSES = ['fighter', 'bomber_tac', 'bomber_str', 'cas', 'naval_bomber', 'transport_air', 'nuke_missile'] as const;
export const UNIT_CLASSES = [...LAND_CLASSES, ...SEA_CLASSES, ...AIR_CLASSES] as const;
export type UnitClass = (typeof UNIT_CLASSES)[number];

export const MOBILITIES = ['foot', 'motor', 'tracked', 'ship', 'air'] as const;

/** Nation-level modifiers shared by traits, techs and buildings (fractions: 0.1 = +10%). */
export const MODIFIER_KEYS = [
  'income', 'industry', 'manpower', 'research', 'buildSpeed', 'supply', 'org', 'stability',
  'warExhaustion', 'revoltSuppression', 'landAttack', 'landDefense', 'armorAttack', 'navalAttack',
  'airAttack', 'airDefense', 'fortStrength', 'aaStrength', 'nukeYield',
] as const;

export const BUILDING_IDS = ['industry', 'fort', 'airbase', 'port', 'navalBase', 'aa'] as const;
export const BUILDING_EFFECT_KEYS = [
  'industryOutput', 'defense', 'airCapacity', 'supplyThroughput', 'shipCapacity', 'shipRepair', 'aaStrength',
] as const;

export const COMBAT_EFFICIENCY_MODES = ['dynamic', 'progressive', 'static', 'locked', 'random'] as const;
export const TECH_CATEGORIES = ['industry', 'land', 'armor', 'naval', 'air', 'electronics', 'nuclear'] as const;

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lower snake_case');
const key = z.string().regex(/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/, 'i18n keys are dotted, e.g. unit.inf');
const color = z.string().regex(/^#[0-9a-f]{6}$/, 'colours are #rrggbb (lower case)');
const nonNeg = z.number().finite().nonnegative();
const mult = z.number().finite().positive().max(10);
const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'dates are YYYY-MM-DD');

function partialRecord<K extends readonly [string, ...string[]], V extends z.ZodType>(keys: K, value: V) {
  return z.partialRecord(z.enum(keys), value);
}

// ── terrain (data/terrain.json) ──────────────────────────────────────────────

/** Move cost multiplier per mobility class; null = impassable. */
const moveCost = z.strictObject({ foot: mult.nullable(), motor: mult.nullable(), tracked: mult.nullable() });

export const TerrainDef = z.strictObject({
  id: z.enum(TERRAIN_IDS),
  nameKey: key,
  color,
  moveCost,
  /** Defender multiplier. */
  defense: mult,
  /** Attacker multiplier per unit class (absent = 1). */
  attack: partialRecord(UNIT_CLASSES, mult),
  /** Fraction of strength lost per day out of supply on this terrain. */
  supplyAttrition: z.number().min(0).max(1),
  /** Economic weight of one cell (plains = 1). */
  econWeight: nonNeg.max(10),
});
export const TerrainFile = z.strictObject({ terrain: z.array(TerrainDef) });

// ── unit types (data/units/*.json) ───────────────────────────────────────────

export const UnitStats = z.strictObject({
  soft: nonNeg, hard: nonNeg, defense: nonNeg, breakthrough: nonNeg, armor: nonNeg, piercing: nonNeg,
  aa: nonNeg, range_km: nonNeg, speed_kmh: z.number().finite().positive(), org: nonNeg,
  hpPerUnit: z.number().finite().positive(), detection: nonNeg, stealth: nonNeg,
  fuelPerHour: nonNeg, supplyPerHour: nonNeg,
});

export const UnitTypeDef = z
  .strictObject({
    id,
    nameKey: key,
    class: z.enum(UNIT_CLASSES),
    domain: z.enum(['land', 'sea', 'air']),
    /** Men / vehicles / ships / planes per element (SPEC §3.6). */
    elementSize: z.number().int().min(1).max(1000),
    mobility: z.enum(MOBILITIES),
    stats: UnitStats,
    cost: z.strictObject({ gold: nonNeg, industry: nonNeg, manpower: nonNeg, days: z.number().int().min(1) }),
    upkeep: z.strictObject({ gold: nonNeg, supply: nonNeg }),
    terrainMods: partialRecord(TERRAIN_IDS, z.strictObject({ atk: mult, def: mult, speed: mult })),
    techReq: id.optional(),
  })
  .superRefine((u, ctx) => {
    const domain = (LAND_CLASSES as readonly string[]).includes(u.class) ? 'land' : (SEA_CLASSES as readonly string[]).includes(u.class) ? 'sea' : 'air';
    if (u.domain !== domain) ctx.addIssue({ code: 'custom', path: ['domain'], message: `class ${u.class} is a ${domain} class` });
    const okMobility = domain === 'land' ? ['foot', 'motor', 'tracked'] : domain === 'sea' ? ['ship'] : ['air'];
    if (!okMobility.includes(u.mobility)) {
      ctx.addIssue({ code: 'custom', path: ['mobility'], message: `${domain} units move by ${okMobility.join('|')}` });
    }
  });
export const UnitsFile = z.strictObject({ types: z.array(UnitTypeDef).min(1) });

// ── tech (data/tech/*.json) ──────────────────────────────────────────────────

export const TechDef = z.strictObject({
  id,
  nameKey: key,
  category: z.enum(TECH_CATEGORIES),
  /** Earliest historical year; research before it costs extra (ahead-of-time penalty). */
  year: z.number().int().min(1900).max(2100),
  cost: z.strictObject({ gold: nonNeg, industry: nonNeg, days: z.number().int().min(1) }),
  prereqs: z.array(id),
  modifiers: partialRecord(MODIFIER_KEYS, z.number().finite().min(-1).max(5)),
});
export const TechFile = z.strictObject({ techs: z.array(TechDef).min(1) });

// ── traits (data/traits/*.json) ──────────────────────────────────────────────

export const TraitDef = z.strictObject({
  id,
  nameKey: key,
  descKey: key,
  modifiers: partialRecord(MODIFIER_KEYS, z.number().finite().min(-1).max(5)),
  /** Added to the nation's aggression (0..100) by the AI. */
  aggressionBias: z.number().int().min(-50).max(50),
  /** Traits that cannot be combined with this one (checked both ways). */
  excludes: z.array(id),
});
export const TraitsFile = z.strictObject({ traits: z.array(TraitDef).min(1) });

// ── buildings (data/buildings/*.json) ────────────────────────────────────────

export const BuildingDef = z.strictObject({
  id: z.enum(BUILDING_IDS),
  nameKey: key,
  maxLevel: z.number().int().min(1).max(20),
  /** Per level built. */
  cost: z.strictObject({ gold: nonNeg, industry: nonNeg, days: z.number().int().min(1) }),
  upkeep: z.strictObject({ gold: nonNeg }),
  coastalOnly: z.boolean(),
  /** Effect per level. */
  perLevel: partialRecord(BUILDING_EFFECT_KEYS, z.number().finite().positive()),
});
export const BuildingsFile = z.strictObject({ buildings: z.array(BuildingDef).min(1) });

// ── maps (data/maps/<id>/map.json) ───────────────────────────────────────────

const Projection = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('miller'), latTopDeg: z.number().min(0).max(90), latBottomDeg: z.number().min(-90).max(0) }),
  /** Synthetic flat grid (toy world): square cells, no latitude scaling. */
  z.strictObject({ type: z.literal('flat') }),
]);

export const MapMeta = z
  .strictObject({
    id,
    nameKey: key,
    projection: Projection,
    /** Width of the full map at the equator, km (Earth: 40 075). */
    widthKm: z.number().positive(),
    sizes: z
      .array(z.strictObject({ id: z.string().regex(/^[A-Z]+$/), w: z.number().int().min(16), h: z.number().int().min(8) }))
      .min(1),
    defaultSize: z.string(),
    wrapX: z.boolean(),
    /** Path (relative to the site root) of the asset manifest, for maps with generated assets. */
    assets: z.string().optional(),
  })
  .superRefine((m, ctx) => {
    if (!m.sizes.some((s) => s.id === m.defaultSize)) {
      ctx.addIssue({ code: 'custom', path: ['defaultSize'], message: `'${m.defaultSize}' is not one of sizes[].id` });
    }
    m.sizes.forEach((s, i) => {
      if (s.w !== 2 * s.h) ctx.addIssue({ code: 'custom', path: ['sizes', i], message: `${s.w}×${s.h} is not 2:1 (square cells)` });
    });
  });

// ── straits (data/maps/<id>/straits.json) ────────────────────────────────────

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** AoC-style walkable crossings: water cells on the segment a→b become Terrain.Crossing (PLAN 1.2). */
export const StraitDef = z.strictObject({ id, nameKey: key, a: lonLat, b: lonLat });
export const StraitsFile = z.strictObject({ straits: z.array(StraitDef) });

// ── scenarios (data/scenarios/<id>/scenario.json) ────────────────────────────

export const ScenarioSettings = z.strictObject({
  combatEfficiency: z.enum(COMBAT_EFFICIENCY_MODES),
  winnerTakesAll: z.boolean(),
  loopingMap: z.boolean(),
  nukesEnabled: z.boolean(),
  aiEnabled: z.boolean(),
  revival: z.strictObject({ maxPerNation: z.number().int().min(0).max(20), cooldownDays: z.number().int().min(0) }),
});

export const ScenarioMeta = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/),
  nameKey: key,
  descKey: key,
  map: id,
  /** Map size id; absent = the map's default size. */
  size: z.string().optional(),
  startDate: date,
  settings: ScenarioSettings,
});

// ── scenario nations + ownership (data/scenarios/<id>/{nations,ownership}.json) ─

const tag = z.string().regex(/^[A-Z]{3}$/, 'nation tags are three upper-case letters');

/** Nation registry (PLAN 1.3; traits, cores, puppets and alliances join in PLAN 1.4). Id = index + 1. */
export const NationDef = z.strictObject({ tag, nameKey: key, color });
export const NationsFile = z.strictObject({ nations: z.array(NationDef).min(1).max(65535) });

const ring = z.array(lonLat).min(3);

/** 1938 ownership rules (PLAN 1.3): country → tag, province overrides, polygon regions, occupation. */
export const OwnershipFile = z.strictObject({
  comment: z.string().optional(),
  /** adm0_a3 → owner tag (null = unowned). Every adm0 in the admin-1 data must be listed. */
  byCountry: z.record(z.string().regex(/^[A-Z0-9]{3}$/), tag.nullable()),
  /** adm1_code → owner tag. */
  byProvince: z.record(z.string(), tag),
  /** Applied in order to land cells currently owned by one of `onlyFrom`. */
  regions: z.array(z.strictObject({ id, owner: tag, onlyFrom: z.array(tag).min(1), note: z.string().optional(), ring })),
  /** Sets the controller of `owner`'s cells inside the ring (occupation). */
  occupation: z.array(z.strictObject({ id, controller: tag, owner: tag, note: z.string().optional(), ring })),
});

export type TerrainDef = z.infer<typeof TerrainDef>;
export type UnitTypeDef = z.infer<typeof UnitTypeDef>;
export type TechDef = z.infer<typeof TechDef>;
export type TraitDef = z.infer<typeof TraitDef>;
export type BuildingDef = z.infer<typeof BuildingDef>;
export type MapMeta = z.infer<typeof MapMeta>;
export type ScenarioMeta = z.infer<typeof ScenarioMeta>;
export type NationDef = z.infer<typeof NationDef>;
export type OwnershipFile = z.infer<typeof OwnershipFile>;

// ── file table + validation ──────────────────────────────────────────────────

/** Paths are relative to `data/`, with `/` separators. */
export const DATA_FILES: readonly { pattern: RegExp; schema: z.ZodType }[] = [
  { pattern: /^terrain\.json$/, schema: TerrainFile },
  { pattern: /^units\/[a-z0-9_]+\.json$/, schema: UnitsFile },
  { pattern: /^tech\/[a-z0-9_]+\.json$/, schema: TechFile },
  { pattern: /^traits\/[a-z0-9_]+\.json$/, schema: TraitsFile },
  { pattern: /^buildings\/[a-z0-9_]+\.json$/, schema: BuildingsFile },
  { pattern: /^maps\/[a-z0-9_]+\/map\.json$/, schema: MapMeta },
  { pattern: /^maps\/[a-z0-9_]+\/straits\.json$/, schema: StraitsFile },
  { pattern: /^scenarios\/[a-z0-9_]+\/scenario\.json$/, schema: ScenarioMeta },
  { pattern: /^scenarios\/[a-z0-9_]+\/nations\.json$/, schema: NationsFile },
  { pattern: /^scenarios\/[a-z0-9_]+\/ownership\.json$/, schema: OwnershipFile },
];

export function schemaFor(file: string): z.ZodType | undefined {
  return DATA_FILES.find((d) => d.pattern.test(file))?.schema;
}

/** `types[2].stats.speed_kmh` from a zod issue path. */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const p of path) out += typeof p === 'number' ? `[${p}]` : out === '' ? String(p) : `.${String(p)}`;
  return out === '' ? '(root)' : out;
}

/** Validates one file against its schema; returns readable errors (empty = valid). */
export function validateFile(file: string, json: unknown): string[] {
  const schema = schemaFor(file);
  if (!schema) return [`${file}: no schema matches this path (add it to DATA_FILES in src/sim/data/schemas.ts)`];
  const r = schema.safeParse(json);
  return r.success ? [] : r.error.issues.map((i) => `${file}: ${formatPath(i.path)}: ${i.message}`);
}

/** Every i18n key a data set references (for the catalog check, which lives outside the sim). */
export function collectKeys(files: Readonly<Record<string, unknown>>): string[] {
  const keys: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === 'object') {
      for (const k of Object.keys(v).sort()) {
        const x = (v as Record<string, unknown>)[k];
        if ((k === 'nameKey' || k === 'descKey') && typeof x === 'string') keys.push(x);
        else walk(x);
      }
    }
  };
  for (const f of Object.keys(files).sort()) walk(files[f]);
  return keys;
}

/**
 * Validates a whole data set (`files`: path relative to data/ → parsed JSON). Runs every file's
 * schema, then the cross-file checks (only on files that passed their schema).
 */
export function validateDataSet(files: Readonly<Record<string, unknown>>): string[] {
  const errors: string[] = [];
  const ok: Record<string, unknown> = {};
  for (const f of Object.keys(files).sort()) {
    const e = validateFile(f, files[f]);
    if (e.length) errors.push(...e);
    else ok[f] = files[f];
  }
  const of = <T>(re: RegExp): [string, T][] =>
    Object.keys(ok).filter((f) => re.test(f)).map((f) => [f, ok[f] as T]);

  // Unique ids across all files of a kind.
  const unique = <T extends { id: string }>(kind: string, entries: [string, T[]][]): Map<string, T> => {
    const seen = new Map<string, T>();
    const where = new Map<string, string>();
    for (const [f, list] of entries) {
      list.forEach((x, i) => {
        if (seen.has(x.id)) errors.push(`${f}: ${kind}[${i}].id: duplicate id '${x.id}' (also in ${where.get(x.id)})`);
        seen.set(x.id, x);
        where.set(x.id, f);
      });
    }
    return seen;
  };

  const terrainFiles = of<z.infer<typeof TerrainFile>>(/^terrain\.json$/);
  for (const [f, t] of terrainFiles) {
    const got = t.terrain.map((x) => x.id).join(',');
    if (got !== TERRAIN_IDS.join(',')) errors.push(`${f}: terrain: must list every class once, in enum order: ${TERRAIN_IDS.join(', ')}`);
  }

  const techs = unique('techs', of<z.infer<typeof TechFile>>(/^tech\//).map(([f, x]) => [f, x.techs]));
  for (const [f, x] of of<z.infer<typeof TechFile>>(/^tech\//)) {
    x.techs.forEach((t, i) =>
      t.prereqs.forEach((p, j) => {
        const pre = techs.get(p);
        if (!pre) errors.push(`${f}: techs[${i}].prereqs[${j}]: unknown tech '${p}'`);
        else if (pre.year > t.year) errors.push(`${f}: techs[${i}].prereqs[${j}]: '${p}' (${pre.year}) is later than '${t.id}' (${t.year})`);
      }),
    );
  }
  // Acyclic: depth-first search with colours, ids visited in sorted order for stable messages.
  const state = new Map<string, 1 | 2>();
  const visit = (tid: string, stack: string[]): void => {
    const s = state.get(tid);
    if (s === 2) return;
    if (s === 1) {
      errors.push(`tech: prerequisite cycle ${[...stack.slice(stack.indexOf(tid)), tid].join(' → ')}`);
      return;
    }
    state.set(tid, 1);
    for (const p of techs.get(tid)?.prereqs ?? []) if (techs.has(p)) visit(p, [...stack, tid]);
    state.set(tid, 2);
  };
  for (const tid of [...techs.keys()].sort()) visit(tid, []);

  const unitFiles = of<z.infer<typeof UnitsFile>>(/^units\//);
  unique('types', unitFiles.map(([f, x]) => [f, x.types]));
  for (const [f, x] of unitFiles) {
    x.types.forEach((u, i) => {
      if (u.techReq !== undefined && !techs.has(u.techReq)) errors.push(`${f}: types[${i}].techReq: unknown tech '${u.techReq}'`);
    });
  }

  const traitFiles = of<z.infer<typeof TraitsFile>>(/^traits\//);
  const traits = unique('traits', traitFiles.map(([f, x]) => [f, x.traits]));
  for (const [f, x] of traitFiles) {
    x.traits.forEach((t, i) =>
      t.excludes.forEach((e, j) => {
        const other = traits.get(e);
        if (!other) errors.push(`${f}: traits[${i}].excludes[${j}]: unknown trait '${e}'`);
        else if (!other.excludes.includes(t.id)) errors.push(`${f}: traits[${i}].excludes[${j}]: '${e}' does not exclude '${t.id}' back`);
        if (e === t.id) errors.push(`${f}: traits[${i}].excludes[${j}]: a trait cannot exclude itself`);
      }),
    );
  }

  unique('buildings', of<z.infer<typeof BuildingsFile>>(/^buildings\//).map(([f, x]) => [f, x.buildings]));

  const maps = new Map<string, MapMeta>();
  for (const [f, m] of of<MapMeta>(/^maps\/[a-z0-9_]+\/map\.json$/)) {
    const dir = f.split('/')[1];
    if (m.id !== dir) errors.push(`${f}: id: '${m.id}' must match its directory '${dir}'`);
    maps.set(m.id, m);
  }
  for (const [f, st] of of<z.infer<typeof StraitsFile>>(/^maps\/[a-z0-9_]+\/straits\.json$/)) {
    const dir = f.split('/')[1]!;
    if (!(`maps/${dir}/map.json` in files)) errors.push(`${f}: no map.json next to this file`);
    unique('straits', [[f, st.straits]]);
  }
  for (const [f, nf] of of<z.infer<typeof NationsFile>>(/^scenarios\/[a-z0-9_]+\/nations\.json$/)) {
    const tags = new Map<string, number>();
    nf.nations.forEach((n, i) => {
      if (tags.has(n.tag)) errors.push(`${f}: nations[${i}].tag: duplicate tag '${n.tag}' (also nations[${tags.get(n.tag)}])`);
      tags.set(n.tag, i);
    });
    const own = ok[f.replace(/nations\.json$/, 'ownership.json')] as OwnershipFile | undefined;
    if (!own) continue;
    const of2 = f.replace(/nations\.json$/, 'ownership.json');
    const check = (t: string | null, where: string): void => {
      if (t !== null && !tags.has(t)) errors.push(`${of2}: ${where}: unknown nation '${t}'`);
    };
    for (const k of Object.keys(own.byCountry).sort()) check(own.byCountry[k]!, `byCountry.${k}`);
    for (const k of Object.keys(own.byProvince).sort()) check(own.byProvince[k]!, `byProvince.${k}`);
    own.regions.forEach((r, i) => {
      check(r.owner, `regions[${i}].owner`);
      r.onlyFrom.forEach((t, j) => check(t, `regions[${i}].onlyFrom[${j}]`));
    });
    own.occupation.forEach((o, i) => {
      check(o.controller, `occupation[${i}].controller`);
      check(o.owner, `occupation[${i}].owner`);
    });
  }
  for (const [f] of of<OwnershipFile>(/^scenarios\/[a-z0-9_]+\/ownership\.json$/)) {
    if (!(f.replace(/ownership\.json$/, 'nations.json') in ok)) errors.push(`${f}: no valid nations.json next to this file`);
  }
  for (const [f, s] of of<ScenarioMeta>(/^scenarios\/[a-z0-9_]+\/scenario\.json$/)) {
    const dir = f.split('/')[1];
    if (s.id !== dir) errors.push(`${f}: id: '${s.id}' must match its directory '${dir}'`);
    const m = maps.get(s.map);
    if (!m) errors.push(`${f}: map: unknown map '${s.map}'`);
    else if (s.size !== undefined && !m.sizes.some((z) => z.id === s.size)) errors.push(`${f}: size: map '${s.map}' has no size '${s.size}'`);
    if (m && s.settings.loopingMap && !m.wrapX) errors.push(`${f}: settings.loopingMap: map '${s.map}' does not wrap`);
  }
  return errors;
}
