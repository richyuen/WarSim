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

/** JSX attributes whose values are shown to users and must come from t() (i18n, PLAN 0.21). */
const USER_FACING_ATTRS = new Set(['title', 'alt', 'placeholder', 'label', 'aria-label', 'aria-description', 'aria-placeholder']);
const HAS_LETTER = /\p{L}/u;

/** @param {unknown} v */
const isUserText = (v) => typeof v === 'string' && HAS_LETTER.test(v);

/** @type {import('eslint').Rule.RuleModule} */
const noLiteralUiString = {
  meta: {
    type: 'problem',
    docs: { description: 'UI text must come from t() (i18n from day one, PROMPT.md)' },
    schema: [],
    messages: { literal: "Literal UI text '{{text}}': use t('key') with a key in src/ui/i18n/en.json." },
  },
  create(context) {
    /** @param {import('estree').Node} node @param {string} text */
    const report = (node, text) =>
      context.report({ node, messageId: 'literal', data: { text: text.trim().slice(0, 40) } });
    /** @param {any} node */
    const checkExpr = (node) => {
      if (!node) return;
      if (node.type === 'Literal' && isUserText(node.value)) report(node, String(node.value));
      if (node.type === 'TemplateLiteral') {
        const raw = node.quasis.map((/** @type {any} */ q) => q.value.cooked ?? '').join('');
        if (isUserText(raw)) report(node, raw);
      }
      if (node.type === 'ConditionalExpression') {
        checkExpr(node.consequent);
        checkExpr(node.alternate);
      }
      if (node.type === 'LogicalExpression') checkExpr(node.right);
    };
    return {
      /** @param {any} node */
      JSXText(node) {
        if (isUserText(node.value)) report(node, node.value);
      },
      /** @param {any} node */
      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) checkExpr(node.expression);
      },
      /** @param {any} node */
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (!USER_FACING_ATTRS.has(name) || !node.value) return;
        if (node.value.type === 'Literal' && isUserText(node.value.value)) report(node.value, String(node.value.value));
        if (node.value.type === 'JSXExpressionContainer') checkExpr(node.value.expression);
      },
    };
  },
};

export default {
  meta: { name: 'warsim' },
  rules: { 'module-boundaries': moduleBoundaries, 'no-literal-ui-string': noLiteralUiString },
};
