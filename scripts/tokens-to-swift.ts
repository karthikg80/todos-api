#!/usr/bin/env node
// Generate ios/TodosApp/TodosApp/Core/Theme/DesignTokens.swift from
// client-react/src/styles/tokens.css. Parses the :root and
// body.dark-mode blocks, categorizes tokens by prefix, and emits a
// Swift enum hierarchy (DS.Color / DS.Radius / DS.Spacing /
// DS.FontSize) plus a Color(light:dark:) helper.
//
// Run:
//   npx ts-node scripts/tokens-to-swift.ts             # write
//   npx ts-node scripts/tokens-to-swift.ts --check     # exit non-zero on drift

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(__dirname, "..");
const TOKENS_CSS = resolve(ROOT, "client-react/src/styles/tokens.css");
const OUTPUT_SWIFT = resolve(
  ROOT,
  "ios/TodosApp/TodosApp/Core/Theme/DesignTokens.swift",
);

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extracts the declaration body for the first rule whose selector
 * starts with `selectorPrefix`. Uses brace counting so nested @media /
 * nested blocks inside the CSS don't confuse a flat regex.
 */
function extractBlock(css: string, selectorPrefix: string): string | null {
  const start = css.indexOf(selectorPrefix);
  if (start < 0) return null;
  const openBrace = css.indexOf("{", start);
  if (openBrace < 0) return null;
  let depth = 1;
  let i = openBrace + 1;
  while (i < css.length && depth > 0) {
    const char = css[i];
    if (char === "{") depth++;
    else if (char === "}") depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) return null;
  return css.slice(openBrace + 1, i);
}

type Decl = Map<string, string>;

function parseDecls(block: string): Decl {
  const out: Decl = new Map();
  // Strip nested blocks (e.g. `@media (...) { :root { ... } }`) so
  // matchAll on the flat body doesn't pick up tokens from descendant rules.
  const flat = block.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, "");
  const matches = flat.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g);
  for (const match of matches) {
    out.set(match[1], match[2].trim().replace(/\s+/g, " "));
  }
  return out;
}

function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(v);
}

function isPxValue(v: string): boolean {
  return /^-?\d*(?:\.\d+)?px$/.test(v);
}

function isRemValue(v: string): boolean {
  return /^-?\d*(?:\.\d+)?rem$/.test(v);
}

function toCGFloat(v: string): number | null {
  if (isPxValue(v)) return Number(v.replace("px", ""));
  if (isRemValue(v)) return Number(v.replace("rem", "")) * 16;
  return null;
}

function classifyNumeric(
  name: string,
  value: string,
): {
  group: "Radius" | "Spacing" | "FontSize";
  field: string;
  cg: number;
} | null {
  // Keep the category prefix in the Swift field name so identifiers that
  // map to numeric CSS tokens (e.g. `--s-1`, `--r-2xl`) stay valid Swift
  // identifiers once camelCased (`s1`, `r2xl`).
  const cg = toCGFloat(value);
  if (cg == null) return null;
  if (name.startsWith("r-")) return { group: "Radius", field: name, cg };
  if (name.startsWith("s-")) return { group: "Spacing", field: name, cg };
  if (name.startsWith("fs-")) return { group: "FontSize", field: name, cg };
  return null;
}

const COLOR_NAME_PREFIXES = [
  "bg",
  "surface",
  "text",
  "muted",
  "border",
  "accent",
  "success",
  "warning",
  "danger",
  "viz",
];

function isColorToken(name: string): boolean {
  return COLOR_NAME_PREFIXES.some(
    (p) => name === p || name.startsWith(`${p}-`),
  );
}

/** swift-safe identifier: "accent-secondary-2" → "accentSecondary2" */
function swiftIdent(name: string): string {
  const parts = name.split("-");
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")
  );
}

interface ColorEntry {
  original: string;
  ident: string;
  light: string;
  dark: string;
}

interface NumericEntry {
  original: string;
  ident: string;
  value: number;
}

function build(): string {
  const css = stripComments(readFileSync(TOKENS_CSS, "utf8"));
  const rootBlock = extractBlock(css, ":root");
  const darkBlock = extractBlock(css, "body.dark-mode");
  if (!rootBlock) throw new Error("tokens.css: missing :root { ... } block");
  if (!darkBlock)
    throw new Error("tokens.css: missing body.dark-mode { ... } block");
  const light = parseDecls(rootBlock);
  const dark = parseDecls(darkBlock);

  const colors: ColorEntry[] = [];
  const radius: NumericEntry[] = [];
  const spacing: NumericEntry[] = [];
  const fontSize: NumericEntry[] = [];

  for (const [name, value] of light) {
    if (isColorToken(name) && isHexColor(value)) {
      const darkValue = dark.get(name);
      colors.push({
        original: name,
        ident: swiftIdent(name),
        light: value,
        dark: isHexColor(darkValue ?? "") ? (darkValue as string) : value,
      });
      continue;
    }
    const numeric = classifyNumeric(name, value);
    if (numeric) {
      const entry: NumericEntry = {
        original: name,
        ident: swiftIdent(numeric.field),
        value: numeric.cg,
      };
      if (numeric.group === "Radius") radius.push(entry);
      else if (numeric.group === "Spacing") spacing.push(entry);
      else fontSize.push(entry);
    }
  }

  const sortByOriginal = <T extends { original: string }>(arr: T[]) =>
    arr.sort((a, b) => a.original.localeCompare(b.original));
  sortByOriginal(colors);
  sortByOriginal(radius);
  sortByOriginal(spacing);
  sortByOriginal(fontSize);

  const lines: string[] = [];
  lines.push("// AUTOGENERATED — do not edit by hand.");
  lines.push("// Source: client-react/src/styles/tokens.css");
  lines.push("// Regenerate: npm run tokens:to-swift");
  lines.push("");
  lines.push("import SwiftUI");
  lines.push("#if canImport(UIKit)");
  lines.push("import UIKit");
  lines.push("");
  lines.push("extension Color {");
  lines.push(
    "    /// Initialize a theme-aware color from light/dark hex literals.",
  );
  lines.push("    init(light: String, dark: String) {");
  lines.push("        self = Color(UIColor { traits in");
  lines.push("            traits.userInterfaceStyle == .dark");
  lines.push("                ? UIColor(hex: dark)");
  lines.push("                : UIColor(hex: light)");
  lines.push("        })");
  lines.push("    }");
  lines.push("}");
  lines.push("");
  lines.push("extension UIColor {");
  lines.push("    fileprivate convenience init(hex: String) {");
  lines.push(
    '        let trimmed = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))',
  );
  lines.push("        var value: UInt64 = 0");
  lines.push("        Scanner(string: trimmed).scanHexInt64(&value)");
  lines.push("        let r, g, b, a: CGFloat");
  lines.push("        switch trimmed.count {");
  lines.push("        case 3:");
  lines.push(
    "            r = CGFloat((value >> 8) & 0xF) / 15; g = CGFloat((value >> 4) & 0xF) / 15; b = CGFloat(value & 0xF) / 15; a = 1",
  );
  lines.push("        case 6:");
  lines.push(
    "            r = CGFloat((value >> 16) & 0xFF) / 255; g = CGFloat((value >> 8) & 0xFF) / 255; b = CGFloat(value & 0xFF) / 255; a = 1",
  );
  lines.push("        case 8:");
  lines.push(
    "            r = CGFloat((value >> 24) & 0xFF) / 255; g = CGFloat((value >> 16) & 0xFF) / 255; b = CGFloat((value >> 8) & 0xFF) / 255; a = CGFloat(value & 0xFF) / 255",
  );
  lines.push("        default:");
  lines.push("            r = 0; g = 0; b = 0; a = 1");
  lines.push("        }");
  lines.push("        self.init(red: r, green: g, blue: b, alpha: a)");
  lines.push("    }");
  lines.push("}");
  lines.push("#endif");
  lines.push("");
  lines.push("enum DS {");
  lines.push("    #if canImport(UIKit)");
  lines.push("    enum Color {");
  for (const c of colors) {
    lines.push(
      `        static let ${c.ident} = SwiftUI.Color(light: "${c.light}", dark: "${c.dark}")`,
    );
  }
  lines.push("    }");
  lines.push("    #endif");
  lines.push("");
  emitEnum(lines, "Radius", radius);
  lines.push("");
  emitEnum(lines, "Spacing", spacing);
  lines.push("");
  emitEnum(lines, "FontSize", fontSize);
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function emitEnum(out: string[], name: string, entries: NumericEntry[]): void {
  out.push(`    enum ${name} {`);
  for (const e of entries) {
    out.push(`        static let ${e.ident}: CGFloat = ${e.value}`);
  }
  out.push("    }");
}

function main(): number {
  const check = process.argv.includes("--check");
  const generated = build();
  if (!existsSync(dirname(OUTPUT_SWIFT))) {
    mkdirSync(dirname(OUTPUT_SWIFT), { recursive: true });
  }
  if (check) {
    const committed = existsSync(OUTPUT_SWIFT)
      ? readFileSync(OUTPUT_SWIFT, "utf8")
      : "";
    if (committed !== generated) {
      process.stderr.write(
        `tokens-to-swift: ${OUTPUT_SWIFT} is out of date with client-react/src/styles/tokens.css.\n` +
          `Run \`npm run tokens:to-swift\` and commit the result.\n`,
      );
      return 1;
    }
    process.stdout.write(`tokens-to-swift: ${OUTPUT_SWIFT} is up to date.\n`);
    return 0;
  }
  writeFileSync(OUTPUT_SWIFT, generated);
  process.stdout.write(`tokens-to-swift: wrote ${OUTPUT_SWIFT}\n`);
  return 0;
}

process.exit(main());
