// Presentation only: never use this to construct document IDs or stored data.
export function academicDisplay(value) {
  if (typeof value === "string") return value.replace(/\b(?:Hinduism|Saivam)\b/gi, "Saivanery");
  if (Array.isArray(value)) return value.map(academicDisplay);
  return value;
}

// Export a copy; keep raw records, identifiers, dates and callbacks untouched.
export function academicExport(value) {
  if (Array.isArray(value)) return value.map(academicExport);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, /(?:id|key|code)$/i.test(key) ? item : academicExport(item),
    ]));
  }
  return academicDisplay(value);
}

// Searching the visible label and legacy text keeps both spellings useful.
export function academicSearch(value, query) {
  const needle = String(academicDisplay(query) ?? "").toLowerCase();
  return String(academicDisplay(value) ?? "").toLowerCase().includes(needle) ||
    String(value ?? "").toLowerCase().includes(String(query ?? "").toLowerCase());
}

// Uploads use the new visible label but retain the established stored value.
export function storedReligion(value) {
  return /^saivanery$/i.test(String(value ?? "").trim()) ? "Hinduism" : value;
}

// Format spreadsheet cell text after creation, retaining column/object keys.
export function academicWorksheet(sheet) {
  const output = { ...sheet };
  const identifierColumns = new Set(Object.entries(sheet)
    .filter(([address, cell]) => /^[A-Z]+1$/.test(address) && /(?:id|key|code)$/i.test(String(cell?.v ?? "")))
    .map(([address]) => address.replace(/1$/, "")));
  for (const [address, cell] of Object.entries(sheet)) {
    if (/^[A-Z]+[0-9]+$/.test(address) && cell?.t === "s" &&
      !identifierColumns.has(address.replace(/[0-9]+$/, ""))) {
      output[address] = { ...cell, v: academicDisplay(cell.v) };
      if (typeof cell.w === "string") output[address].w = academicDisplay(cell.w);
    }
  }
  return output;
}
