export function isPlausibleIpfsCid(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(value)) {
    let number = 0n;
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    for (const char of value) number = number * 58n + BigInt(alphabet.indexOf(char));
    const decoded = number.toString(16).padStart(2, '0');
    const leadingZeroBytes = value.match(/^1*/)?.[0].length ?? 0;
    const bytes = [
      ...Array.from({ length: leadingZeroBytes }, () => 0),
      ...decoded.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)),
    ];
    return bytes.length === 34 && bytes[0] === 0x12 && bytes[1] === 0x20;
  }

  if (!/^b[a-z2-7]{7,123}$/.test(value)) return false;
  const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const char of value.slice(1)) {
    accumulator = (accumulator << 5) | base32Alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bits > 0 && accumulator !== 0) return false;

  let offset = 0;
  const readVarint = (): number | null => {
    let result = 0;
    let shift = 0;
    while (offset < bytes.length && shift < 35) {
      const byte = bytes[offset++];
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }
    return null;
  };
  const version = readVarint();
  const codec = readVarint();
  const hashCode = readVarint();
  const digestLength = readVarint();
  return version === 1 &&
    codec !== null && codec > 0 &&
    hashCode !== null && hashCode > 0 &&
    digestLength !== null && digestLength > 0 &&
    offset + digestLength === bytes.length;
}
