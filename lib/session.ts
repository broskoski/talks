// Signed session cookie. Uses Web Crypto only, so the same code runs in
// proxy.ts and in server actions / route handlers.

export const SESSION_COOKIE = "talks_session";
const SESSION_DAYS = 30;

const encoder = new TextEncoder();

async function signingKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`talks-session:${secret}`),
  );
  return crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function createSessionToken(secret: string): Promise<string> {
  const expires = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const key = await signingKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(expires));
  return `${expires}.${toHex(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expires = token.slice(0, dot);
  const sig = fromHex(token.slice(dot + 1));
  if (!sig || !/^\d+$/.test(expires)) return false;
  if (Number(expires) < Date.now()) return false;
  const key = await signingKey(secret);
  // crypto.subtle.verify is constant-time.
  return crypto.subtle.verify("HMAC", key, sig, encoder.encode(expires));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
