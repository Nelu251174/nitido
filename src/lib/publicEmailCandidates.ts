const localPunctuation = ".!#$%&'*+/=?^_`{|}~-";
const alphanumeric = (code: number) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const localCharacter = (text: string, index: number) => alphanumeric(text.charCodeAt(index)) || localPunctuation.includes(text[index]);

/** The old domain expression accepts the longest valid prefix, including one-letter TLDs. */
function domainEnd(text: string, start: number): number {
  if (!alphanumeric(text.charCodeAt(start))) return -1;
  let position = start;
  while (alphanumeric(text.charCodeAt(position)) || text[position] === '-') position++;
  if (text[position] !== '.' || !alphanumeric(text.charCodeAt(position - 1))) return -1;
  let end = -1;
  while (text[position] === '.' && alphanumeric(text.charCodeAt(position + 1))) {
    position++;
    while (alphanumeric(text.charCodeAt(position)) || text[position] === '-') {
      if (alphanumeric(text.charCodeAt(position))) end = position + 1;
      position++;
    }
    // A trailing hyphen ends the valid prefix; it cannot join another label.
    if (end !== position) break;
  }
  return end;
}

/** Scan each local/domain segment once; malformed public text must not block the HTTP event loop. */
export function publicEmailCandidates(text: string): string[] {
  const matches: string[] = [];
  let consumed = 0, search = 0;
  for (let at = text.indexOf('@', search); at !== -1; at = text.indexOf('@', search)) {
    search = at + 1;
    let start = at;
    while (start > consumed && localCharacter(text, start - 1)) start--;
    if (start === at) continue;
    const end = domainEnd(text, at + 1);
    if (end === -1) continue;
    // Match consumption stays identical even when the existing 254-character filter rejects it.
    consumed = search = end;
    if (end - start <= 254) matches.push(text.slice(start, end));
  }
  return matches;
}
