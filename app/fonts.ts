import localFont from "next/font/local";

// Areal is Are.na's variable typeface, vendored from @aredotna/tokens/fonts.
// One file covers weights 100–900. Monospace is the same family with the
// "MONO" axis raised via font-variation-settings, as are.na itself does it.
export const areal = localFont({
  src: "./fonts/areal.woff2",
  variable: "--font-areal",
  display: "swap",
  weight: "100 900",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});
