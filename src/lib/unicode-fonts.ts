/** Unicode "font" transforms used by the bold text / font generator tools (shared server + client). */
const A = 'A'.charCodeAt(0), a = 'a'.charCodeAt(0), d0 = '0'.charCodeAt(0);
const range = (upper: number, lower: number, digits?: number) => (ch: string) => { const c = ch.charCodeAt(0); if (c >= A && c <= A + 25) return String.fromCodePoint(upper + c - A); if (c >= a && c <= a + 25) return String.fromCodePoint(lower + c - a); if (digits && c >= d0 && c <= d0 + 9) return String.fromCodePoint(digits + c - d0); return ch; };
const fix = (map: Record<string, string>, f: (ch: string) => string) => (ch: string) => map[ch] ?? f(ch);
export const STYLES: Record<string, { fr: string; en: string; note?: { fr: string; en: string }; fn: (s: string) => string }> = {
  bold_serif: { fr: 'Gras (avec empattements)', en: 'Bold (serif)', note: { fr: 'Le gras classique avec empattements. Fonctionne aussi avec les chiffres.', en: 'Classic serif bold. Works with digits too.' }, fn: (s) => [...s].map(range(0x1d400, 0x1d41a, 0x1d7ce)).join('') },
  bold_sans: { fr: 'Gras sans empattements', en: 'Bold (sans-serif)', note: { fr: 'Gras sans empattements, le plus proche de la police de LinkedIn et d\'Instagram.', en: 'Sans-serif bold, closest to the LinkedIn and Instagram font.' }, fn: (s) => [...s].map(range(0x1d5d4, 0x1d5ee, 0x1d7ec)).join('') },
  italic: { fr: 'Italique', en: 'Italic', fn: (s) => [...s].map(fix({ h: 'ℎ' }, range(0x1d434, 0x1d44e))).join('') },
  bold_italic: { fr: 'Gras italique', en: 'Bold italic', fn: (s) => [...s].map(range(0x1d468, 0x1d482)).join('') },
  italic_sans: { fr: 'Italique sans empattements', en: 'Italic (sans-serif)', fn: (s) => [...s].map(range(0x1d608, 0x1d622)).join('') },
  bold_italic_sans: { fr: 'Gras italique sans empattements', en: 'Bold italic (sans-serif)', fn: (s) => [...s].map(range(0x1d63c, 0x1d656)).join('') },
  underline: { fr: 'Souligné', en: 'Underlined', note: { fr: 'Ajoute un soulignement combinant (U+0332) après chaque caractère.', en: 'Adds a combining low line (U+0332) after each character.' }, fn: (s) => [...s].map((c) => (c === '\n' ? c : c + '̲')).join('') },
  strike: { fr: 'Barré', en: 'Strikethrough', note: { fr: 'Ajoute un trait combinant (U+0336) après chaque caractère.', en: 'Adds a combining long stroke (U+0336) after each character.' }, fn: (s) => [...s].map((c) => (c === '\n' ? c : c + '̶')).join('') },
  mono: { fr: 'Chasse fixe', en: 'Monospace', fn: (s) => [...s].map(range(0x1d670, 0x1d68a, 0x1d7f6)).join('') },
  script: { fr: 'Calligraphié', en: 'Script', fn: (s) => [...s].map(fix({ B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }, range(0x1d49c, 0x1d4b6))).join('') },
  script_bold: { fr: 'Calligraphié gras', en: 'Bold script', fn: (s) => [...s].map(range(0x1d4d0, 0x1d4ea)).join('') },
  double: { fr: 'Ajouré (double barre)', en: 'Double-struck', fn: (s) => [...s].map(fix({ C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }, range(0x1d538, 0x1d552, 0x1d7d8))).join('') },
  fraktur: { fr: 'Gothique', en: 'Fraktur', fn: (s) => [...s].map(fix({ C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }, range(0x1d504, 0x1d51e))).join('') },
  circled: { fr: 'Cerclé', en: 'Circled', fn: (s) => [...s].map((ch) => { const c = ch.charCodeAt(0); if (c >= A && c <= A + 25) return String.fromCodePoint(0x24b6 + c - A); if (c >= a && c <= a + 25) return String.fromCodePoint(0x24d0 + c - a); if (c >= d0 + 1 && c <= d0 + 9) return String.fromCodePoint(0x2460 + c - d0 - 1); return ch; }).join('') },
  small_caps: { fr: 'Petites capitales', en: 'Small caps', fn: (s) => { const m: Record<string, string> = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' }; return [...s.toLowerCase()].map((c) => m[c] ?? c).join(''); } },
  wide: { fr: 'Pleine chasse', en: 'Fullwidth', fn: (s) => [...s].map((c) => { const k = c.charCodeAt(0); return k >= 33 && k <= 126 ? String.fromCharCode(k + 0xfee0) : c === ' ' ? '　' : c; }).join('') },
};
export const styleEntries = Object.entries(STYLES);
