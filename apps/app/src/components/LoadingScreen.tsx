/**
 * Loading screen — ASCII "milaidy" logo with per-character dither fade.
 *
 * Each letter independently cycles through quantised opacity steps on its
 * own random schedule, producing a constantly shifting dither pattern that
 * resolves into the logo and dissolves again.
 */

import { useMemo } from "react";

/* ── ASCII source (matches src/ascii.ts) ───────────────────────────── */

const ASCII_LINES = [
  "        miladym                        iladym      ",
  "    iladymil                                ady    ",
  "    mil                                         ad   ",
  "ymi                                   ladymila     ",
  "dym                                    ila dymila    ",
  "dy       miladymil                     ady   milady   ",
  "    miladymilad                     ymila dymilady  ",
  "    mi    ladymila                   dymiladymil     ",
  "adymiladymiladymi                  l  adymila d    ",
  "ym   iladymiladymil                 ad ymilad  y    ",
  "m  il  adymiladym  i                  l   ad   y     ",
  "    mi  ladymila  dy                    mi           ",
  "    la          dy                         mil      ",
  "        ad      ym                                   ",
  "        iladym",
];

/* ── Types ─────────────────────────────────────────────────────────── */

interface CharCell {
  char: string;
  isLetter: boolean;
  /** Random animation-delay in seconds */
  delay: number;
  /** Random animation-duration in seconds */
  duration: number;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function LoadingScreen() {
  /* Build the character grid once — each non-space character gets its
     own random timing so the dither pattern is never uniform. */
  const grid = useMemo<CharCell[][]>(
    () =>
      ASCII_LINES.map((line) =>
        [...line].map((char) => ({
          char,
          isLetter: char !== " ",
          delay: Math.random() * 5,
          duration: 1.4 + Math.random() * 3,
        })),
      ),
    [],
  );

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg gap-8">
      <div
        role="status"
        aria-label="Loading"
        style={{
          fontFamily: "var(--mono)",
          fontSize: "clamp(7px, 1.4vw, 14px)",
          lineHeight: 1.35,
          color: "var(--text)",
          userSelect: "none",
        }}
      >
        {grid.map((line, y) => (
          <div key={y} style={{ whiteSpace: "pre" }}>
            {line.map((c, x) =>
              c.isLetter ? (
                <span
                  key={x}
                  className="dither-char"
                  style={{
                    animationDelay: `${c.delay.toFixed(2)}s`,
                    animationDuration: `${c.duration.toFixed(2)}s`,
                  }}
                >
                  {c.char}
                </span>
              ) : (
                <span key={x}>{c.char}</span>
              ),
            )}
          </div>
        ))}
      </div>
      <div
        className="text-muted text-xs tracking-widest uppercase"
        style={{ fontFamily: "var(--mono)" }}
      >
        loading
      </div>
    </div>
  );
}
