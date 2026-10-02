/**
 * Parity checker for docs/PARITY.md (PROMPT.md "FILES YOU MAINTAIN", SPEC §10).
 *
 * Table 1 ("AoC parity rows") is scored: verified = 1, partial = 0.5, not started = 0.
 * Table 2 ("Our additions") is validated but unscored. The header score line is
 * generated (`npm run parity -- --write`) and must match the tables.
 */

export const STATUSES = ['verified', 'partial', 'not started'] as const;
export type Status = (typeof STATUSES)[number];

export const TABLE1_COLUMNS = ['#', 'feature', 'AoC behaviour', 'our behaviour', 'status', 'evidence', 'notes'];
export const TABLE2_COLUMNS = ['#', 'addition', 'description', 'status', 'evidence', 'notes'];

/** `[TEXT 2026-10-02]`, `[VISUAL 2026-10-02]` or `[TEXT+VISUAL 2026-10-02]` in the AoC behaviour cell. */
const SOURCE_TAG = /\[(TEXT\+VISUAL|TEXT|VISUAL) (\d{4}-\d{2}-\d{2})\]/;
const SCORE_LINE =
  /^\*\*Parity score: ([\d.]+)%\*\* \(verified (\d+) · partial (\d+) · not started (\d+) · total (\d+)\)$/m;

export interface Row {
  line: number;
  cells: Record<string, string>;
}

export interface Counts {
  verified: number;
  partial: number;
  notStarted: number;
  total: number;
}

export interface ParityResult {
  errors: string[];
  counts: Counts;
  score: number;
  table1: Row[];
  table2: Row[];
}

/** Split a markdown table row on unescaped pipes. */
function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && trimmed[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

const isTableLine = (l: string | undefined): boolean => l !== undefined && l.trim().startsWith('|');

/** Parse the first markdown table after the heading that starts with `headingPrefix`. */
function parseTable(lines: string[], headingPrefix: string, columns: string[], errors: string[]): Row[] {
  const start = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (start < 0) {
    errors.push(`missing heading "${headingPrefix}"`);
    return [];
  }
  let i = start + 1;
  while (i < lines.length && !isTableLine(lines[i]) && !lines[i]!.startsWith('## ')) i++;
  if (!isTableLine(lines[i])) {
    errors.push(`no table under "${headingPrefix}"`);
    return [];
  }
  const header = splitRow(lines[i]!);
  if (header.join('|') !== columns.join('|')) {
    errors.push(`line ${i + 1}: table columns are [${header.join(', ')}], expected [${columns.join(', ')}]`);
    return [];
  }
  i += 2; // header + separator
  const rows: Row[] = [];
  for (; isTableLine(lines[i]); i++) {
    const cells = splitRow(lines[i]!);
    if (cells.length !== columns.length) {
      errors.push(`line ${i + 1}: expected ${columns.length} cells, got ${cells.length}`);
      continue;
    }
    const rec: Record<string, string> = {};
    columns.forEach((c, k) => (rec[c] = cells[k] ?? ''));
    rows.push({ line: i + 1, cells: rec });
  }
  return rows;
}

/** Evidence paths are the backtick-quoted items of the evidence cell. */
export function evidencePaths(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => (m[1] ?? '').trim()).filter((p) => p.length > 0);
}

function checkRows(
  rows: Row[],
  table: string,
  needsSource: boolean,
  exists: (p: string) => boolean,
  errors: string[],
): void {
  rows.forEach((row, idx) => {
    const where = `${table} line ${row.line}`;
    const num = row.cells['#'];
    if (num !== String(idx + 1)) {
      errors.push(`${where}: row number "${num}" should be ${idx + 1} (rows stay numbered and in order)`);
    }
    const status = row.cells['status'] ?? '';
    if (!(STATUSES as readonly string[]).includes(status)) {
      errors.push(`${where}: status "${status}" is not one of ${STATUSES.join(' / ')}`);
    }
    if (needsSource && !SOURCE_TAG.test(row.cells['AoC behaviour'] ?? '')) {
      errors.push(`${where}: AoC behaviour needs a dated source tag like [TEXT 2026-10-02], [VISUAL …] or [TEXT+VISUAL …]`);
    }
    if (status === 'verified') {
      const paths = evidencePaths(row.cells['evidence'] ?? '');
      if (paths.length === 0) errors.push(`${where}: verified row has no evidence paths`);
      for (const p of paths) if (!exists(p)) errors.push(`${where}: evidence path does not exist: ${p}`);
    }
  });
}

export function computeScore(c: Counts): number {
  if (c.total === 0) return 0;
  return Math.round(((c.verified + 0.5 * c.partial) / c.total) * 1000) / 10;
}

export function formatScoreLine(c: Counts): string {
  return (
    `**Parity score: ${computeScore(c).toFixed(1)}%** ` +
    `(verified ${c.verified} · partial ${c.partial} · not started ${c.notStarted} · total ${c.total})`
  );
}

export function checkParity(markdown: string, exists: (path: string) => boolean): ParityResult {
  const errors: string[] = [];
  const lines = markdown.split(/\r?\n/);
  const table1 = parseTable(lines, '## Table 1', TABLE1_COLUMNS, errors);
  const table2 = parseTable(lines, '## Table 2', TABLE2_COLUMNS, errors);
  checkRows(table1, 'Table 1', true, exists, errors);
  checkRows(table2, 'Table 2', false, exists, errors);

  const counts: Counts = { verified: 0, partial: 0, notStarted: 0, total: table1.length };
  for (const r of table1) {
    const s = r.cells['status'];
    if (s === 'verified') counts.verified++;
    else if (s === 'partial') counts.partial++;
    else if (s === 'not started') counts.notStarted++;
  }
  if (table1.length === 0) errors.push('Table 1 has no rows');

  const m = SCORE_LINE.exec(markdown);
  const expected = formatScoreLine(counts);
  if (!m) errors.push(`missing header score line; expected:\n    ${expected}`);
  else if (m[0] !== expected) {
    errors.push(`header disagrees with the table:\n    header:   ${m[0]}\n    computed: ${expected}`);
  }
  return { errors, counts, score: computeScore(counts), table1, table2 };
}

/** Replace the header score line with the computed one. */
export function writeScore(markdown: string, counts: Counts): string {
  if (!SCORE_LINE.test(markdown)) throw new Error('PARITY.md has no score line to update');
  return markdown.replace(SCORE_LINE, formatScoreLine(counts));
}
