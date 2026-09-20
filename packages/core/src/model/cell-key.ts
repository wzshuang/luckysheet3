/** Cell key helpers: sparse storage uses "r_c" string keys. */

export function cellKey(row: number, col: number): string {
  return `${row}_${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const i = key.indexOf("_");
  return {
    row: Number(key.slice(0, i)),
    col: Number(key.slice(i + 1)),
  };
}

/** 0-based column index → A, B, … Z, AA, … */
export function colToLetter(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** A1 → { row: 0, col: 0 } */
export function parseA1(ref: string): { row: number; col: number } {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim());
  if (!m) throw new Error(`Invalid cell ref: ${ref}`);
  const letters = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number(m[2]) - 1, col: col - 1 };
}

export function toA1(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

/** Selection → "A1" or "A1:B3" (normalized top-left : bottom-right) */
export function selectionToLabel(sel: {
  row: [number, number];
  column: [number, number];
}): string {
  const r0 = Math.min(sel.row[0], sel.row[1]);
  const r1 = Math.max(sel.row[0], sel.row[1]);
  const c0 = Math.min(sel.column[0], sel.column[1]);
  const c1 = Math.max(sel.column[0], sel.column[1]);
  const start = toA1(r0, c0);
  if (r0 === r1 && c0 === c1) return start;
  return `${start}:${toA1(r1, c1)}`;
}
