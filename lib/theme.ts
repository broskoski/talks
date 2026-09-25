import {
  ALIASES,
  COLORS,
  SPACE,
  FONT_SIZES,
  RADII,
  FONTS,
} from "@aredotna/tokens";

// Turn the Are.na design tokens into CSS custom properties so they can be used
// from plain CSS / inline styles without hand-copying any values. The tokens
// package stays the single source of truth — edit there (or bump the dep), not here.
//
// Mirrors how are.na's main app (Sander) maps the tokens into a theme, but with
// CSS variables instead of Stitches: scales + a light/dark palette + semantic
// aliases (background/foreground/link/…). See lib/theme.ts notes per section.

// Non-color entries that live in COLORS.* but aren't colors — skip them so we
// don't emit junk like `--color-blend: multiply`.
const NON_COLOR_KEYS = new Set(["blend", "blendInverted"]);

function kebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
}

// Palette → `--color-<key>` lines. Palette keys (gray0, blue1, foregroundShadow…)
// are kept verbatim so aliases and existing CSS can reference `--color-gray7` etc.
function paletteLines(colors: Record<string, string | number | boolean>): string[] {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(colors)) {
    if (NON_COLOR_KEYS.has(k)) continue;
    if (typeof v === "string") lines.push(`--color-${k}: ${v};`);
  }
  return lines;
}

// Aliases are token refs (e.g. background: "$gray0"), resolved to a var()
// reference: `--color-background: var(--color-gray0)`. Because the value points
// at a palette var rather than a literal, the alias re-resolves automatically
// when the palette changes per theme — so this block is emitted ONCE under :root.
// (Assumption: every alias value is a "$token" ref. A literal-valued alias would
// need per-theme emission.)
function aliasLines(): string[] {
  return Object.entries(ALIASES).map(([name, ref]) => {
    const target = (ref as string).replace(/^\$/, "");
    return `--color-${kebab(name)}: var(--color-${target});`;
  });
}

function scaleLines(): string[] {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(SPACE)) lines.push(`--space-${k}: ${v};`);
  for (const [k, v] of Object.entries(FONT_SIZES)) lines.push(`--font-size-${k}: ${v};`);
  for (const [k, v] of Object.entries(RADII)) lines.push(`--radius-${k}: ${v};`);
  return lines;
}

function fontLines(): string[] {
  // Areal (set as a CSS var by next/font on <html>) backs both sans and mono;
  // mono is the same family with the "MONO" axis raised (see the .mono treatment
  // in the Text primitive). The token's system stacks are the fallback until the
  // webfont loads.
  return [
    `--font-sans: var(--font-areal), ${FONTS.sans};`,
    `--font-mono: var(--font-areal), ${FONTS.mono};`,
    `--font-serif: ${FONTS.serif};`,
  ];
}

const indent = (lines: string[]) => lines.join("\n  ");

const rootBlock = `:root {\n  ${indent([
  ...scaleLines(),
  ...paletteLines(COLORS.light),
  ...aliasLines(),
  ...fontLines(),
])}\n}`;

const darkPalette = indent(paletteLines(COLORS.dark));

// Dark mode follows the OS setting — no switcher. Only the palette vars are
// overridden; the alias vars (var() refs) follow automatically.
const darkBlock = `@media (prefers-color-scheme: dark) {
  :root {
  ${darkPalette}
  }
}`;

// Forced dark theme for a subtree (the stage screen), independent of the OS
// setting. Aliases must be re-emitted here: a var() reference declared on :root
// resolves on :root, so overriding only the palette on a descendant would not
// re-resolve --color-background etc.
const darkClassBlock = `.theme-dark {\n  ${indent([
  ...paletteLines(COLORS.dark),
  ...aliasLines(),
])}\n}`;

export const themeCss = `${rootBlock}\n\n${darkBlock}\n\n${darkClassBlock}`;
