/**
 * Convert a 0-based column index to an Excel-style column letter (A, B, ..., Z, AA, AB, ...).
 */
export function colToLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Build a range string like "A5:AC5" for a given row number and column count.
 */
export function buildRowRange(rowNum: number, colCount: number): string {
  const lastCol = colToLetter(colCount - 1);
  return `A${rowNum}:${lastCol}${rowNum}`;
}
