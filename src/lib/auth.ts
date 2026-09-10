/**
 * Authentication & security utilities.
 *
 * The app uses compact HMAC-signed tokens and PBKDF2-SHA512 password
 * hashing without requiring an external authentication service. Provider
 * OAuth credentials are handled separately by their server-side adapters.
 *
 * SECURITY NOTES:
 *   • Passwords are hashed with PBKDF2-SHA512 + a per-user random salt — never stored plaintext.
 *   • Access tokens are short-lived (15 min); refresh tokens long-lived (30 d).
 *   • Tokens are signed with a server secret loaded from env (JWT_SECRET).
 *   • Refresh tokens are rotated on every use (re-use detection).
 */
import { createHash, randomBytes, timingSafeEqual, createHmac, pbkdf2Sync } from "crypto";

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

/** Get the JWT secret, throwing if missing. Never log this value. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    // In dev we fall back to a deterministic value so the app still boots.
    if (process.env.NODE_ENV !== "production") {
      return "dev-only-secret-do-not-use-in-production-xxxxxxxxxxxxxx";
    }
    throw new Error("JWT_SECRET must be set in production (>=32 chars)");
  }
  return secret;
}

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  workspaceId?: string;
  role?: string;
  type: "access";
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // unique token id, stored in Session table for revocation
  type: "refresh";
  iat: number;
  exp: number;
}

/**
 * Create an unsigned base64url-encoded JWT payload.
 * Compact HMAC-SHA256 token implementation used by this self-hosted app.
 * Rotate JWT_SECRET during planned maintenance to invalidate all signed
 * application tokens.
 */
function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sign(data: string): string {
  return base64url(createHmac("sha256", getJwtSecret()).update(data).digest());
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type" | "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const body: AccessTokenPayload = { ...payload, type: "access", iat: now, exp: now + ACCESS_TOKEN_TTL };
  const payloadB64 = base64url(JSON.stringify(body));
  const headerB64 = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const sig = sign(`${headerB64}.${payloadB64}`);
  return `${headerB64}.${payloadB64}.${sig}`;
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type" | "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const body: RefreshTokenPayload = { ...payload, type: "refresh", iat: now, exp: now + REFRESH_TOKEN_TTL };
  const payloadB64 = base64url(JSON.stringify(body));
  const headerB64 = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const sig = sign(`${headerB64}.${payloadB64}`);
  return `${headerB64}.${payloadB64}.${sig}`;
}

/** Verify a JWT signature and return the decoded payload, or null. */
export function verifyToken<T>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sig] = parts;
  const expectedSig = sign(`${headerB64}.${payloadB64}`);
  // Timing-safe comparison to prevent signature oracle attacks
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload as T;
  } catch {
    return null;
  }
}


export interface OAuthStatePayload {
  userId: string;
  workspaceId: string;
  provider: string;
  exp: number;
}

export function signOAuthState(input: Omit<OAuthStatePayload, "exp">, ttlSeconds = 600): string {
  const payload: OAuthStatePayload = { ...input, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length != b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as OAuthStatePayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface PasswordResetPayload {
  sub: string;
  email: string;
  guard: string;
  type: "password_reset";
  iat: number;
  exp: number;
}

function passwordGuard(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 32);
}

/** Create a single-password-version reset token. A successful password
 * change automatically invalidates any older reset links because the guard
 * is derived from the current password hash. */
export function signPasswordResetToken(input: { userId: string; email: string; passwordHash: string }, ttlSeconds = 30 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const body: PasswordResetPayload = {
    sub: input.userId,
    email: input.email,
    guard: passwordGuard(input.passwordHash),
    type: "password_reset",
    iat: now,
    exp: now + ttlSeconds,
  };
  const encoded = base64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPasswordResetToken(token: string, currentPasswordHash?: string | null): PasswordResetPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !currentPasswordHash) return null;
  const expected = sign(encoded);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as PasswordResetPayload;
    if (payload.type !== "password_reset" || !payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.guard !== passwordGuard(currentPasswordHash)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Password hashing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Hash a password using PBKDF2 with a per-password salt.
 * The iteration count and salt are stored alongside the hash so the format can
 * be upgraded later without storing plaintext passwords.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 210_000, 64, "sha512").toString("hex");
  return `pbkdf2$210000$${salt}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHash = parts[3];
  const actualHash = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  try {
    return timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Token extraction from request headers                                      */
/* -------------------------------------------------------------------------- */

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

/** Hash an API token for storage. Only the hash is persisted; the raw
 *  token is shown to the user exactly once at creation time. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a new opaque API token with a human-identifiable prefix. */
export function generateApiToken(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const token = `sflow_${raw}`;
  return {
    token,
    hash: hashApiToken(token),
    prefix: token.slice(0, 12),
  };
}

/* -------------------------------------------------------------------------- */
/*  Role-based access control                                                 */
/* -------------------------------------------------------------------------- */

export type Role = "owner" | "admin" | "editor" | "contributor" | "viewer";

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  contributor: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

/** Returns true if `role` meets or exceeds `required`. */
export function hasRole(role: Role | string | undefined, required: Role): boolean {
  if (!role) return false;
  return (ROLE_HIERARCHY[role as Role] ?? -1) >= ROLE_HIERARCHY[required];
}

/** Permission matrix: action -> minimum role required. */
export const PERMISSIONS = {
  "post.create": "contributor",
  "post.publish": "editor",
  "post.delete": "editor",
  "account.connect": "admin",
  "account.disconnect": "admin",
  "team.invite": "admin",
  "team.remove": "owner",
  "client.manage": "admin",
  "billing.manage": "owner",
  "workspace.update": "admin",
  "workspace.delete": "owner",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | string | undefined, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission] as Role);
}
