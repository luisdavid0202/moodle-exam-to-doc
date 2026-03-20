/**
 * Converts Unicode Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF)
 * to their plain ASCII equivalents, since PDF renderers don't handle
 * supplementary plane characters (surrogate pairs) reliably.
 *
 * e.g. 𝑎 (U+1D44E) → a,  𝑥 (U+1D465) → x,  𝑩 (U+1D409) → B
 */

// Ranges: [start codepoint, base char codepoint, length]
const RANGES: [number, number, number][] = [
  [0x1d400, 65, 26],  // Bold A-Z
  [0x1d41a, 97, 26],  // Bold a-z
  [0x1d434, 65, 26],  // Italic A-Z
  [0x1d44e, 97, 26],  // Italic a-z  (h missing → U+210E handled separately)
  [0x1d468, 65, 26],  // Bold Italic A-Z
  [0x1d482, 97, 26],  // Bold Italic a-z
  [0x1d49c, 65, 26],  // Script A-Z
  [0x1d4b6, 97, 26],  // Script a-z
  [0x1d4d0, 65, 26],  // Bold Script A-Z
  [0x1d4ea, 97, 26],  // Bold Script a-z
  [0x1d504, 65, 26],  // Fraktur A-Z
  [0x1d51e, 97, 26],  // Fraktur a-z
  [0x1d538, 65, 26],  // Double-struck A-Z
  [0x1d552, 97, 26],  // Double-struck a-z
  [0x1d56c, 65, 26],  // Bold Fraktur A-Z
  [0x1d586, 97, 26],  // Bold Fraktur a-z
  [0x1d5a0, 65, 26],  // Sans-serif A-Z
  [0x1d5ba, 97, 26],  // Sans-serif a-z
  [0x1d5d4, 65, 26],  // Sans-serif Bold A-Z
  [0x1d5ee, 97, 26],  // Sans-serif Bold a-z
  [0x1d608, 65, 26],  // Sans-serif Italic A-Z
  [0x1d622, 97, 26],  // Sans-serif Italic a-z
  [0x1d63c, 65, 26],  // Sans-serif Bold Italic A-Z
  [0x1d656, 97, 26],  // Sans-serif Bold Italic a-z
  [0x1d670, 65, 26],  // Monospace A-Z
  [0x1d68a, 97, 26],  // Monospace a-z
  [0x1d7ce, 48, 10],  // Bold digits 0-9
  [0x1d7d8, 48, 10],  // Double-struck digits 0-9
  [0x1d7e2, 48, 10],  // Sans-serif digits 0-9
  [0x1d7ec, 48, 10],  // Sans-serif Bold digits 0-9
  [0x1d7f6, 48, 10],  // Monospace digits 0-9
]

// Build a lookup map for O(1) conversion
const MATH_CHAR_MAP = new Map<number, string>()

for (const [start, base, len] of RANGES) {
  for (let i = 0; i < len; i++) {
    MATH_CHAR_MAP.set(start + i, String.fromCharCode(base + i))
  }
}

// Isolated exceptions not covered by contiguous ranges
const EXCEPTIONS: Record<number, string> = {
  0x210e: "h", // ℎ Planck constant (replaces missing italic h)
  0x2113: "l", // ℓ script small l
  0x212c: "B", // ℬ script B
  0x2130: "E", // ℰ script E
  0x2131: "F", // ℱ script F
  0x210b: "H", // ℋ script H
  0x2110: "I", // ℐ script I
  0x2112: "L", // ℒ script L
  0x2133: "M", // ℳ script M
  0x211b: "R", // ℛ script R
  0x212f: "e", // ℯ script e
  0x210a: "g", // ℊ script g
  0x2134: "o", // ℴ script o
}

/**
 * Supplemental Arrows-A (U+27F0–U+27FF) and Supplemental Arrows-B (U+2900–U+297F)
 * are not covered by Noto Sans. Map them to BMP arrow equivalents that ARE in the font.
 */
const ARROW_MAP: Record<number, string> = {
  0x27f0: "↑",  // ⟰ → ↑
  0x27f1: "↓",  // ⟱ → ↓
  0x27f2: "↺",  // ⟲ → ↺
  0x27f3: "↻",  // ⟳ → ↻
  0x27f4: "→",  // ⟴ → →
  0x27f5: "←",  // ⟵ LONG LEFT ARROW
  0x27f6: "→",  // ⟶ LONG RIGHT ARROW
  0x27f7: "↔",  // ⟷ LONG LEFT RIGHT ARROW
  0x27f8: "⇐",  // ⟸ LONG LEFTWARDS DOUBLE ARROW
  0x27f9: "⇒",  // ⟹ LONG RIGHTWARDS DOUBLE ARROW
  0x27fa: "⇔",  // ⟺ LONG LEFT RIGHT DOUBLE ARROW
  0x27fb: "↤",  // ⟻ → ↤
  0x27fc: "↦",  // ⟼ → ↦
  0x27fd: "⇐",  // ⟽ → ⇐
  0x27fe: "⇒",  // ⟾ → ⇒
  0x27ff: "↭",  // ⟿ → ↭
  // Common Supplemental Arrows-B
  0x2900: "⇒",  0x2901: "⇒",
  0x290a: "↑",  0x290b: "↓",
  0x2912: "↑",  0x2913: "↓",
}

export function normalizeMathChars(text: string): string {
  // Use spread to correctly iterate over supplementary plane characters
  const chars = [...text]
  let result = ""
  for (const ch of chars) {
    const cp = ch.codePointAt(0)!
    if (EXCEPTIONS[cp] !== undefined) {
      result += EXCEPTIONS[cp]
    } else if (MATH_CHAR_MAP.has(cp)) {
      result += MATH_CHAR_MAP.get(cp)!
    } else if (ARROW_MAP[cp] !== undefined) {
      result += ARROW_MAP[cp]
    } else {
      result += ch
    }
  }
  return result
}
