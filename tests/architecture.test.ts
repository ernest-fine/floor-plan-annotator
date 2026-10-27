import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = resolve(root, "src");
const domainRoot = resolve(sourceRoot, "features/annotator/domain");
const sharedRoot = resolve(sourceRoot, "shared");
const appRoot = resolve(sourceRoot, "app");

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }).sort();
}

const sourceFiles = filesIn(sourceRoot);
const moduleFiles = sourceFiles.filter((file) => /\.[cm]?[jt]sx?$/.test(file));
const inside = (file: string, directory: string) =>
  file === directory || file.startsWith(`${directory}/`);

interface Dependency {
  file: string;
  specifier: string;
  target: string | undefined;
  line: number;
}

function resolveLocal(file: string, specifier: string): string | undefined {
  const clean = specifier.split(/[?#]/)[0];
  const base = clean.startsWith("@/")
    ? resolve(sourceRoot, clean.slice(2))
    : clean.startsWith(".")
      ? resolve(dirname(file), clean)
      : undefined;
  if (!base) return undefined;
  return [base, ...[".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].map((suffix) => base + suffix)]
    .find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? base;
}

function importsIn(file: string): Dependency[] {
  const source = readFileSync(file, "utf8");
  // Tokenize strings and comments together so commented imports and text inside
  // strings cannot accidentally become architecture dependencies.
  const tokens = [...source.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g)]
    .filter(([token]) => !token.startsWith("//") && !token.startsWith("/*"));
  const dependencies: Dependency[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index][0];
    if (token !== "import" && token !== "export") continue;
    const next = tokens[index + 1]?.[0] ?? "";
    if (next === "(" || next === ".") continue; // Dynamic imports / import.meta.
    if (token === "export" && !["*", "{", "type"].includes(next)) continue;
    let literal = token === "import" && /^["']/.test(next) ? tokens[index + 1] : undefined;
    if (!literal) {
      for (let cursor = index + 1; cursor < tokens.length; cursor++) {
        const current = tokens[cursor][0];
        if ([";", "import", "export", "="].includes(current)) break;
        if (current === "from" && /^["']/.test(tokens[cursor + 1]?.[0] ?? "")) {
          literal = tokens[cursor + 1];
          break;
        }
      }
    }
    if (!literal) continue;
    const specifier = literal[0].slice(1, -1);
    dependencies.push({
      file,
      specifier,
      target: resolveLocal(file, specifier),
      line: source.slice(0, tokens[index].index).split("\n").length,
    });
  }
  return dependencies;
}

const dependencies = moduleFiles.flatMap(importsIn);
const report = ({ file, specifier, line }: Dependency) =>
  `${relative(root, file)}:${line} imports ${JSON.stringify(specifier)}`;

describe("source architecture", () => {
  it("keeps shared modules independent of app and feature modules", () => {
    const violations = dependencies.filter(({ file, target }) =>
      inside(file, sharedRoot) && target &&
      (inside(target, appRoot) || inside(target, resolve(sourceRoot, "features"))),
    );
    expect(violations.map(report)).toEqual([]);
  });

  it("keeps domain dependencies within domain or generic shared libraries", () => {
    const violations = dependencies.filter(({ file, target }) =>
      inside(file, domainRoot) && (!target ||
        (!inside(target, domainRoot) && !inside(target, resolve(sharedRoot, "lib")))),
    );
    expect(violations.map(report)).toEqual([]);
  });

  it("lets app consume annotator only through its public entry and stylesheet", () => {
    const publicImports = new Set(["@/features/annotator", "@/features/annotator/styles.css"]);
    const violations = dependencies.filter(({ file, target, specifier }) =>
      inside(file, appRoot) && target && inside(target, resolve(sourceRoot, "features")) &&
      !publicImports.has(specifier),
    );
    expect(violations.map(report)).toEqual([]);
  });

  it("retires loose legacy source files", () => {
    const legacyFiles = sourceFiles.map((file) => relative(sourceRoot, file)).filter((file) =>
      /^(?:App\.tsx|main\.tsx|types\.ts|styles\.css)$/.test(file) ||
      /^(?:components\/[^/]+\.tsx|hooks\/[^/]+\.ts|lib\/[^/]+\.ts)$/.test(file),
    );
    expect(legacyFiles).toEqual([]);
  });

  it("uses TSX instead of JSX for source and tests", () => {
    const jsxFiles = [...sourceFiles, ...filesIn(resolve(root, "tests"))]
      .filter((file) => file.endsWith(".jsx"))
      .map((file) => relative(root, file));
    expect(jsxFiles).toEqual([]);
  });
});
