// @ts-check
// Local ESLint plugin: module-boundary enforcement for SPEC §2.1.
//
// Import targets are resolved lexically (path.resolve against the importing file),
// not through the filesystem, so the rule works on virtual file paths (lint fixtures)
// and on modules that do not exist yet.
import path from 'node:path';

/** Which src layers each layer may import (SPEC §2.1). */
export const LAYER_ALLOW = {
  sim: ['sim', 'shared'],
  shared: ['shared'],
  worker: ['worker', 'sim', 'shared'],
  render: ['render', 'shared'],
  ui: ['ui', 'render', 'shared'],
  editor: ['editor', 'ui', 'render', 'shared'],
  app: ['app', 'editor', 'ui', 'render', 'shared'],
};

/**
 * Bare (package) imports allowed per layer. Layers missing here may import any package.
 * The sim must stay pure and runnable in Node and in a worker, so it gets an allowlist.
 */
export const LAYER_PACKAGES = {
  sim: ['zod'],
  shared: [],
};

/** Non-src top-level directories that src code may import from (e.g. JSON data). */
const SHARED_ROOTS = ['data'];

/** @param {string} p */
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * @param {string} relPosix path relative to the repo root, posix separators
 * @returns {string | null} the src layer, or null when outside src/<layer>/
 */
function layerOf(relPosix) {
  const m = /^src\/([^/]+)\//.exec(relPosix);
  return m ? (m[1] ?? null) : null;
}

/** @param {string} source */
function packageName(source) {
  const parts = source.split('/');
  return source.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? source);
}

/** @type {import('eslint').Rule.RuleModule} */
const moduleBoundaries = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the src layer import rules of SPEC §2.1' },
    schema: [],
    messages: {
      layer: "Layer '{{from}}' may not import from layer '{{to}}' (SPEC §2.1).",
      outside: "Layer '{{from}}' may not import '{{source}}' from outside src/ (SPEC §2.1).",
      unknownLayer: "'{{to}}' is not a known src layer (SPEC §2.2).",
      pkg: "Layer '{{from}}' may not import package '{{pkg}}' (allowed: {{allowed}}).",
    },
  },
  create(context) {
    const root = context.cwd;
    const fileRel = toPosix(path.relative(root, context.filename));
    const from = layerOf(fileRel);
    if (from === null || !(from in LAYER_ALLOW)) return {};
    const allowed = LAYER_ALLOW[/** @type {keyof typeof LAYER_ALLOW} */ (from)];
    const pkgAllow =
      from in LAYER_PACKAGES ? LAYER_PACKAGES[/** @type {keyof typeof LAYER_PACKAGES} */ (from)] : null;

    /** @param {import('estree').Node} node @param {unknown} value */
    function check(node, value) {
      if (typeof value !== 'string') return;
      const source = value;
      if (source.startsWith('.') || source.startsWith('/')) {
        const target = toPosix(
          path.relative(root, path.resolve(path.dirname(context.filename), source)),
        );
        const to = layerOf(target + '/');
        if (to !== null) {
          if (!(to in LAYER_ALLOW)) {
            context.report({ node, messageId: 'unknownLayer', data: { to } });
          } else if (!allowed.includes(to)) {
            context.report({ node, messageId: 'layer', data: { from, to } });
          }
          return;
        }
        const top = target.split('/')[0] ?? '';
        if (target === 'src' || !SHARED_ROOTS.includes(top)) {
          context.report({ node, messageId: 'outside', data: { from, source } });
        }
        return;
      }
      if (pkgAllow !== null) {
        const pkg = packageName(source);
        if (!pkgAllow.includes(pkg)) {
          context.report({
            node,
            messageId: 'pkg',
            data: { from, pkg, allowed: pkgAllow.length ? pkgAllow.join(', ') : 'none' },
          });
        }
      }
    }

    return {
      ImportDeclaration: (node) => check(node.source, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node.source, node.source.value);
      },
      ExportAllDeclaration: (node) => check(node.source, node.source.value),
      ImportExpression: (node) => {
        if (node.source.type === 'Literal') check(node.source, node.source.value);
      },
    };
  },
};

export default {
  meta: { name: 'warsim' },
  rules: { 'module-boundaries': moduleBoundaries },
};
