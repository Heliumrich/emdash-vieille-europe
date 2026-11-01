// Keep named suppliers and approved telephone/email details, omit street addresses.
export function redactPostalText(text) {
  const result = text.replace(/,\s*[^,\n]*?(?:weg|strasse|straße|gasse)\s+\d+\s+à\s+\d{4}\s+[^,\n]+,\s*/gi, ', ');
  return result !== text ? result.replace(/^l’adresse de\s+/i, '') : result;
}
