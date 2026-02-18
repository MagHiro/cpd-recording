export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += ch;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < rows.length; i += 1) {
    const current = rows[i];
    if (current.length === 1 && current[0].trim() === "") continue;
    const record: Record<string, string> = {};
    for (let col = 0; col < headers.length; col += 1) {
      record[headers[col]] = (current[col] ?? "").trim();
    }
    records.push(record);
  }

  return records;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function toCsv(headers: string[], records: Array<Record<string, string>>): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => escapeCsvCell(record[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}
