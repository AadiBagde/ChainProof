import { config, describeIpfsMode } from './config.js';

export class IpfsNotConfiguredError extends Error {
  constructor() {
    super(
      'IPFS upload is not configured. Set PINATA_JWT (Pinata) or IPFS_API_URL (local Kubo) in the backend environment.'
    );
    this.name = 'IpfsNotConfiguredError';
  }
}

export function isPlausibleIpfsCid(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(value)) {
    let number = 0n;
    for (const char of value) {
      number = number * 58n + BigInt('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.indexOf(char));
    }
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

function requireCid(value: unknown): string {
  if (!isPlausibleIpfsCid(value) || Buffer.byteLength(value, 'utf8') > 128) {
    throw new Error('IPFS provider returned an invalid content identifier.');
  }
  return value;
}

async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('IPFS upload timed out. Check the provider connection and try again.');
    }
    throw new Error('Could not reach the configured IPFS provider.');
  }
}

export async function uploadToIpfs(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const mode = describeIpfsMode();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'application/octet-stream' });
  form.append('file', blob, fileName || 'evidence.bin');

  if (mode === 'pinata') {
    const response = await providerFetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.pinataJwt}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`IPFS provider rejected the upload (HTTP ${response.status}).`);
    }

    const body: unknown = await response.json().catch(() => null);
    const cid = body && typeof body === 'object' && 'IpfsHash' in body ? body.IpfsHash : undefined;
    return requireCid(cid);
  }

  if (mode === 'kubo') {
    const url = `${config.ipfsApiUrl.replace(/\/$/, '')}/api/v0/add?cid-version=1&pin=true`;
    const response = await providerFetch(url, { method: 'POST', body: form });
    if (!response.ok) {
      throw new Error(`IPFS node rejected the upload (HTTP ${response.status}).`);
    }

    const responseText = await response.text();
    const lastLine = responseText.trim().split(/\r?\n/).at(-1);
    let body: unknown;
    try {
      body = lastLine ? JSON.parse(lastLine) : null;
    } catch {
      body = null;
    }
    const cid = body && typeof body === 'object' && 'Hash' in body ? body.Hash : undefined;
    return requireCid(cid);
  }

  throw new IpfsNotConfiguredError();
}
