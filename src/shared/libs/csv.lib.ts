type Cell = string | number | null | undefined;

// Excel/Sheets treat cells starting with these as formulas; prefix a quote so exported text stays text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: Cell) {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with a UTF-8 BOM and CRLF line endings so Excel opens Vietnamese text correctly. */
export function toCsv(header: string[], rows: Cell[][]) {
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
