const TR_CHAR_MAP = {
  İ: 'i',
  I: 'ı',
  Ğ: 'ğ',
  Ü: 'ü',
  Ş: 'ş',
  Ö: 'ö',
  Ç: 'ç',
  Â: 'a',
  â: 'a',
  Î: 'i',
  î: 'i',
  Û: 'u',
  û: 'u',
  Ä: 'a',
  ä: 'a',
  Ə: 'e',
  ə: 'e',
  Ķ: 'k',
  ķ: 'k',
  Ḩ: 'h',
  ḩ: 'h',
  Ƶ: 'z',
  ƶ: 'z',
  Ň: 'n',
  ň: 'n',
};

export function normalizeTurkish(str = '') {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    out += TR_CHAR_MAP[ch] ?? ch.toLowerCase();
  }
  return out;
}

export function foldAscii(str = '') {
  return normalizeTurkish(str)
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function matchesSearchQuery(text = '', query = '') {
  const q = query.trim();
  if (!q) return true;
  const nt = normalizeTurkish(text);
  const nq = normalizeTurkish(q);
  if (nt.includes(nq)) return true;
  return foldAscii(text).includes(foldAscii(q));
}
