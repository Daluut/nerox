/**
 * CSV writer. Cells that a spreadsheet would treat as a formula (starting with
 * = + - @ or a tab) are prefixed with an apostrophe so an exported task title
 * can't run as a formula when the file is opened.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // The byte-order mark makes Excel read the file as UTF-8.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
