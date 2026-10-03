// PreToolUse guard for the `critic` subagent (.claude/agents/critic.md).
// File tools may only write under critic/; shell commands may not mutate git state.
import path from 'node:path';
import process from 'node:process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};
const root = path.resolve(input.cwd ?? process.cwd());
const criticDir = path.join(root, 'critic');

function deny(reason) {
  process.stderr.write(`critic-guard: ${reason}\n`);
  process.exit(2);
}

if (tool === 'Bash' || tool === 'PowerShell') {
  const cmd = String(args.command ?? '');
  const gitWrite =
    /\bgit\s+(-C\s+\S+\s+)?(commit|push|reset|checkout|switch|restore|stash|add|rm|mv|merge|rebase|cherry-pick|revert|clean|tag|branch\s+-[dDmM])\b/;
  if (gitWrite.test(cmd)) deny('the critic is read-only on the repo; git write commands are blocked.');
  process.exit(0);
}

const target = args.file_path ?? args.notebook_path;
if (!target) process.exit(0);
const abs = path.resolve(root, String(target));
const rel = path.relative(criticDir, abs);
if (rel.startsWith('..') || path.isAbsolute(rel)) {
  deny(`writes are only allowed under critic/ (got ${target}).`);
}
process.exit(0);
