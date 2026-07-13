import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = join(projectRoot, 'src');
const functionsRoot = join(projectRoot, 'functions', 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    const isProductionSource = sourceExtensions.has(extname(entry.name))
      && !entry.name.endsWith('.d.ts')
      && !entry.name.includes('.test.');
    return isProductionSource ? [path] : [];
  }));
  return nested.flat();
};

const files = [...await walk(clientRoot), ...await walk(functionsRoot)];
const fileSet = new Set(files);
const errors = [];
const runtimeGraph = new Map(files.map((file) => [file, []]));

const relativePath = (path) => relative(projectRoot, path).split(sep).join('/');

const resolveImport = (from, specifier) => {
  const base = resolve(dirname(from), specifier);
  const withoutJs = base.endsWith('.js') ? base.slice(0, -3) : base;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((candidate) => fileSet.has(candidate));
};

const moduleLayer = (path) => {
  const local = relative(clientRoot, path);
  if (local.startsWith('..')) return undefined;
  return local.split(sep)[0];
};

const forbiddenDependencies = new Map([
  ['domain', new Set(['components', 'hooks', 'screens', 'services'])],
  ['services', new Set(['components', 'hooks', 'screens'])],
  ['components', new Set(['screens'])],
  ['hooks', new Set(['components', 'screens'])],
]);

const isRuntimeImport = (node) => {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name) return true;
    const bindings = clause.namedBindings;
    return !bindings || !ts.isNamedImports(bindings) || bindings.elements.some((element) => !element.isTypeOnly);
  }
  return !ts.isExportDeclaration(node) || !node.isTypeOnly;
};

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ specifier: node.moduleSpecifier.text, runtime: isRuntimeImport(node) });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) imports.push({ specifier: argument.text, runtime: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const dependency of imports) {
    if (!dependency.specifier.startsWith('.')) continue;
    const target = resolveImport(file, dependency.specifier);
    if (!target) {
      const importedExtension = extname(dependency.specifier);
      if (importedExtension && !['.js', '.ts', '.tsx'].includes(importedExtension)) continue;
      errors.push(`${relativePath(file)}: unresolved relative import ${dependency.specifier}`);
      continue;
    }

    const fileIsClient = file.startsWith(`${clientRoot}${sep}`);
    const targetIsClient = target.startsWith(`${clientRoot}${sep}`);
    const fileIsFunctions = file.startsWith(`${functionsRoot}${sep}`);
    const targetIsFunctions = target.startsWith(`${functionsRoot}${sep}`);
    if ((fileIsClient && targetIsFunctions) || (fileIsFunctions && targetIsClient)) {
      errors.push(`${relativePath(file)}: client and Functions must not import each other (${relativePath(target)})`);
    }

    if (fileIsClient && targetIsClient) {
      const sourceLayer = moduleLayer(file);
      const targetLayer = moduleLayer(target);
      if (sourceLayer && targetLayer && forbiddenDependencies.get(sourceLayer)?.has(targetLayer)) {
        errors.push(`${relativePath(file)}: ${sourceLayer} must not depend on ${targetLayer} (${relativePath(target)})`);
      }
    }

    if (dependency.runtime) runtimeGraph.get(file)?.push(target);
  }
}

const state = new Map();
const stack = [];
const reportedCycles = new Set();

const visitGraph = (file) => {
  state.set(file, 'visiting');
  stack.push(file);
  for (const target of runtimeGraph.get(file) ?? []) {
    if (state.get(target) === 'visiting') {
      const start = stack.indexOf(target);
      const cycle = [...stack.slice(start), target].map(relativePath);
      const key = [...new Set(cycle.slice(0, -1))].sort().join('|');
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        errors.push(`runtime import cycle: ${cycle.join(' -> ')}`);
      }
    } else if (!state.has(target)) {
      visitGraph(target);
    }
  }
  stack.pop();
  state.set(file, 'visited');
};

files.forEach((file) => {
  if (!state.has(file)) visitGraph(file);
});

if (errors.length) {
  console.error(`Architecture check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Architecture check passed (${files.length} TypeScript files, no runtime cycles or forbidden dependencies).`);
}
