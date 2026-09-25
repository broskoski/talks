import type { Metadata } from "next";
import { areal } from "./fonts";
import { themeCss } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talks",
  description: "Audience-assembled talks from Are.na channels",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={areal.variable}>
      <head>
        {/* Are.na design tokens as CSS variables, inlined so they exist before first paint. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
