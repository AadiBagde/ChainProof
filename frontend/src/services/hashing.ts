export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256File(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  return sha256Hex(bytes);
}

export function sha256ToBytes32(hex: string): `0x${string}` {
  const clean = hex.replace(/^0x/, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(clean)) {
    throw new Error('SHA-256 digest must be 64 hexadecimal characters.');
  }
  return `0x${clean}`;
}
