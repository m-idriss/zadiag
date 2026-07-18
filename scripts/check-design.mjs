import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, 'src');
const tokensPath = join(sourceRoot, 'styles', 'tokens.css');
const appCssPath = join(sourceRoot, 'styles', 'app.css');
const errors = [];

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.includes('.test.') ? [path] : [];
  }));
  return nested.flat();
};

const files = await walk(sourceRoot);
const relativePath = (path) => relative(projectRoot, path).split(sep).join('/');
const sourceByFile = new Map(await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')])));
const allSource = [...sourceByFile.values()].join('\n');
const tokens = await readFile(tokensPath, 'utf8');
const appCss = await readFile(appCssPath, 'utf8');
const allCss = `${tokens}\n${appCss}`;
const normalizeColor = (value) => value.toLowerCase().replace(/\s+/g, '');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cssRuleHasDeclaration = (selector, declaration) => {
  const rule = appCss.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  return Boolean(rule?.[1] && declaration.test(rule[1]));
};

if (!/^:root\s*\{/m.test(tokens)) errors.push(`${relativePath(tokensPath)}: missing :root token scope`);
if (/:root\s*\{/.test(appCss)) errors.push(`${relativePath(appCssPath)}: foundational tokens must live in src/styles/tokens.css`);

for (const selector of ['.settings-row', '.settings-help-center > summary']) {
  if (!cssRuleHasDeclaration(selector, /align-items\s*:\s*flex-start\s*;/)) {
    errors.push(`${relativePath(appCssPath)}: ${selector} must keep row icons and actions aligned to the top`);
  }
}

if (!cssRuleHasDeclaration('.routine-catalog-list', /grid-auto-rows\s*:\s*max-content\s*;/)) {
  errors.push(`${relativePath(appCssPath)}: .routine-catalog-list must keep intrinsic rows so Safari cannot compress catalogue cards`);
}

const legacyTokens = ['navy', 'teal', 'mint', 'cream', 'coral', 'muted', 'line', 'surface', 'surface-solid'];
for (const token of legacyTokens) {
  if (new RegExp(`--${token}\\b`).test(allCss) || new RegExp(`--${token}\\b`).test(allSource)) {
    errors.push(`legacy visual token --${token} must use a semantic token`);
  }
}

const definitions = new Map();
for (const [path, css] of [[tokensPath, tokens], [appCssPath, appCss]]) {
  for (const match of css.matchAll(/(--[\w-]+)\s*:/g)) definitions.set(match[1], path);
}
const references = new Set([...`${allCss}\n${allSource}`.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]));
for (const [definition, path] of definitions) {
  if (!references.has(definition)) errors.push(`${relativePath(path)}: unused CSS custom property ${definition}`);
}

const rawColorPattern = /#[0-9a-f]{3,8}\b|rgba?\(/i;
const rawCssColorPattern = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
const tokenizedHexColors = new Map(
  [...tokens.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,8})\b/gi)]
    .map((match) => [normalizeColor(match[2]), match[1]]),
);
const appRawColors = [...appCss.matchAll(rawCssColorPattern)].map((match) => normalizeColor(match[0]));
for (const color of new Set(appRawColors)) {
  const token = tokenizedHexColors.get(color);
  if (token) errors.push(`${relativePath(appCssPath)}: raw color ${color} already has token ${token}`);
}

// Ratchet measured when semantic tokens were introduced. These are ceilings,
// not design targets: cleanup may lower them, but new UI debt must not raise them.
const legacyColorCeiling = { occurrences: 231, distinct: 152 };
const distinctAppRawColors = new Set(appRawColors).size;
if (appRawColors.length > legacyColorCeiling.occurrences) {
  errors.push(`${relativePath(appCssPath)}: raw color occurrences increased from the ${legacyColorCeiling.occurrences} baseline to ${appRawColors.length}`);
}
if (distinctAppRawColors > legacyColorCeiling.distinct) {
  errors.push(`${relativePath(appCssPath)}: distinct raw colors increased from the ${legacyColorCeiling.distinct} baseline to ${distinctAppRawColors}`);
}

for (const [file, source] of sourceByFile) {
  const layer = relative(sourceRoot, file).split(sep)[0];
  if (['components', 'screens'].includes(layer) && rawColorPattern.test(source)) {
    errors.push(`${relativePath(file)}: UI modules must use design tokens instead of raw colors`);
  }

  if (extname(file) !== '.tsx') continue;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.text === 'style' && node.initializer && ts.isJsxExpression(node.initializer)) {
      let expression = node.initializer.expression;
      while (expression && (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression))) expression = expression.expression;
      if (expression && ts.isObjectLiteralExpression(expression)) {
        for (const property of expression.properties) {
          if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
          const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : undefined;
          if (name && !name.startsWith('--')) {
            errors.push(`${relativePath(file)}:${sourceFile.getLineAndCharacterOfPosition(property.getStart()).line + 1}: inline style ${name} must use a CSS custom property`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const sourceWithHtml = `${allSource}\n${await readFile(join(projectRoot, 'index.html'), 'utf8')}`;
const dynamicClassPatterns = [/^status-/, /^filter-status-/, /^tone-/, /^ionicon-/];
const selectors = [...appCss.matchAll(/([^{}]+)\{/g)]
  .flatMap((match) => [...match[1].matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((item) => item[1]));
for (const className of new Set(selectors)) {
  if (!sourceWithHtml.includes(className) && !dynamicClassPatterns.some((pattern) => pattern.test(className))) {
    errors.push(`${relativePath(appCssPath)}: orphan CSS class .${className}`);
  }
}

if (errors.length) {
  console.error(`Design check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Design check passed (${files.length} UI source files, semantic tokens and CSS usage are consistent).`);
}
