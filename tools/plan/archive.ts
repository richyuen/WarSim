/**
 * `npm run plan:archive`: moves the tasks of PLAN.md that are done to docs/PLAN_DONE.md, word for
 * word, and leaves each one's first line in PLAN.md (ADR-231). PLAN.md is then what is still to
 * do, and its part before Phase 7 short enough to be read at the start of an iteration.
 *
 * A task is a `- [x]` line at the left margin with the lines under it. It is done when no box
 * under it is open. Of a task that is open, the parts one level in (`  - [x]`) are moved by the
 * same rule. The first lines stay because the gate (`tickedTasks`), `npm run critic:due`
 * (`tickedReviews`) and the count of PROMPT step 9 read the ticks of PLAN.md: a task's goes to
 * the plan's last section (`LEDGER`, ADR-235), a part's stays in its open task.
 * A task that is one line long has no text to move: the line goes to the last section.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
/** The mark at the end of a first line whose text is in docs/PLAN_DONE.md. */
export const MOVED = ' […]';

const blank = (l: string): boolean => l.trim() === '';
const indent = (l: string): number => l.length - l.trimStart().length;
const open = (lines: readonly string[]): boolean => lines.some((l) => /^\s*- \[ \]/.test(l));

/** The lines from `at` that belong to the item there: those further in, and the blank lines between them. */
function block(lines: readonly string[], at: number): number {
  const depth = indent(lines[at]!);
  let end = at + 1;
  for (let i = at + 1; i < lines.length; i++) {
    if (blank(lines[i]!)) continue;
    if (indent(lines[i]!) <= depth) break;
    end = i + 1;
  }
  return end;
}

export interface Archived {
  /** PLAN.md as it is left. */
  plan: string[];
  /** What goes to the end of docs/PLAN_DONE.md: headings and the tasks under them. */
  done: string[];
  /** The tasks and parts whose text went to `done`. */
  moved: number;
  /** The first lines put under `LEDGER` that were not there. */
  listed: number;
}

/**
 * The last section of PLAN.md: the first line of every numbered task that is done, in the order
 * they were done. The ticks are read there by the gate and `npm run critic:due`; an iteration
 * does not read it (ADR-235).
 */
export const LEDGER = '## Done: the first lines';
const LEDGER_NOTE = 'Not read at the start of an iteration. The gate and `npm run critic:due` read these ticks; the text of each task is in `docs/PLAN_DONE.md`. Written by `npm run plan:archive`: do not edit.';

export function archive(lines: readonly string[]): Archived {
  const at = lines.findIndex((l) => l.startsWith(LEDGER));
  const ledger = at < 0 ? [] : lines.slice(at + 1).filter((l) => l.startsWith('- [x] '));
  const body = at < 0 ? lines : lines.slice(0, at);
  const plan: string[] = [];
  const done: string[] = [];
  let moved = 0;
  let listed = 0;
  // The headings since the last task moved: written before the next one, so that the archive has
  // the plan's sections and none that is empty.
  let headings: string[] = [];
  const move = (item: readonly string[], under: string | null): void => {
    if (headings.length > 0) done.push(...headings, '');
    headings = [];
    if (under !== null) done.push(`Of ${under} (open in PLAN.md):`, '');
    done.push(...item, '');
    moved++;
  };
  for (let i = 0; i < body.length; ) {
    const l = body[i]!;
    if (/^#{2,3} /.test(l)) headings.push(l);
    if (!/^- \[[x ]\] /.test(l)) {
      plan.push(l);
      i++;
      continue;
    }
    const end = block(body, i);
    const item = body.slice(i, end);
    if (l.startsWith('- [x]') && !open(item)) {
      // A task that is done: its text to the archive, unless it went before or is this one
      // line; its first line to the ledger, and the blank lines after it with it.
      const first = item.length > 1 ? l.trimEnd() + MOVED : l;
      if (item.length > 1) move(item, null);
      ledger.push(first);
      listed++;
      for (i = end; i < body.length && blank(body[i]!); i++);
      if (plan.length > 0 && !blank(plan.at(-1)!)) plan.push('');
      continue;
    } else {
      const id = /^- \[[x ]\] (\S+)/.exec(l)![1]!;
      plan.push(l);
      for (let j = 1; j < item.length; ) {
        const p = item[j]!;
        const partEnd = /^ {2}- \[x\] /.test(p) ? block(item, j) : j + 1;
        const part = item.slice(j, partEnd);
        if (part.length > 1 && !open(part) && !p.endsWith(MOVED)) {
          move(part, id);
          plan.push(p.trimEnd() + MOVED);
        } else plan.push(...part);
        j = partEnd;
      }
    }
    i = end;
    // The blank lines after a task are the plan's.
    for (; i < body.length && blank(body[i]!); i++) plan.push(body[i]!);
  }
  while (plan.length > 0 && blank(plan.at(-1)!)) plan.pop();
  if (ledger.length > 0) plan.push('', LEDGER, '', LEDGER_NOTE, '', ...ledger);
  plan.push('');
  return { plan, done, moved, listed };
}

const HEAD = [
  '# WarSim — the plan\'s tasks that are done',
  '',
  'The full text of every task of `PLAN.md` that is ticked, word for word, in the plan\'s order',
  'within each run of `npm run plan:archive` (ADR-231). `PLAN.md` keeps the first line of each.',
  'Nothing here is to do. Search it for what a task was (`PLAN 3.8c` in a comment or an ADR);',
  'do not read it at the start of an iteration.',
  '',
];

function main(): void {
  const planFile = path.join(ROOT, 'PLAN.md');
  const doneFile = path.join(ROOT, 'docs/PLAN_DONE.md');
  const text = readFileSync(planFile, 'utf8');
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const r = archive(text.split(/\r?\n/));
  if (r.moved === 0 && r.listed === 0) {
    console.log('plan: nothing to move');
    return;
  }
  if (r.moved > 0) {
    const before = existsSync(doneFile) ? readFileSync(doneFile, 'utf8').split(/\r?\n/) : HEAD;
    while (before.length > 0 && blank(before.at(-1)!)) before.pop();
    const stamp = `<!-- moved ${new Date().toISOString().slice(0, 10)} -->`;
    writeFileSync(doneFile, [...before, '', stamp, '', ...r.done].join(nl).trimEnd() + nl);
  }
  writeFileSync(planFile, r.plan.join(nl));
  console.log(`plan: ${r.moved} tasks and parts moved to docs/PLAN_DONE.md, ${r.listed} first lines to the plan's last section; PLAN.md ${text.length} → ${r.plan.join(nl).length} characters`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
