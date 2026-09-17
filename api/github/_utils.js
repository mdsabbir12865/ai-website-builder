import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
export const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  "https://ms-do.vercel.app/api/github/callback";

export const REQUIRED_GITHUB_SCOPES = ["repo"];
export const GITHUB_OAUTH_SCOPES = REQUIRED_GITHUB_SCOPES.join(" ");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_API_VERSION = "2022-11-28";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function sendError(res, status, code, error) {
  return res.status(status).json({ success: false, code, error });
}

export function getAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("GitHub integration server configuration is incomplete.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

export async function getSupabaseUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  return error ? null : user || null;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getOAuthSecret() {
  if (!process.env.GITHUB_OAUTH_STATE_SECRET) {
    throw new Error("GitHub OAuth state secret is not configured.");
  }
  return process.env.GITHUB_OAUTH_STATE_SECRET;
}

export function createOAuthState(userId, returnTo = "/dashboard") {
  const encoded = base64url(
    JSON.stringify({
      userId,
      returnTo,
      nonce: crypto.randomBytes(32).toString("hex"),
      createdAt: Date.now(),
    })
  );
  const signature = crypto
    .createHmac("sha256", getOAuthSecret())
    .update(encoded)
    .digest("hex");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state) {
  if (typeof state !== "string" || state.length > 4096) return null;

  const lastDot = state.lastIndexOf(".");
  if (lastDot <= 0 || lastDot >= state.length - 1) return null;

  const encoded = state.slice(0, lastDot);
  const signature = state.slice(lastDot + 1);
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;

  const expected = crypto
    .createHmac("sha256", getOAuthSecret())
    .update(encoded)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64url(encoded));
    if (!payload?.userId || !Number.isFinite(payload.createdAt)) return null;
    if (Date.now() - payload.createdAt > OAUTH_STATE_TTL_MS) return null;
    if (payload.createdAt > Date.now() + 60_000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate OAuth callback state.
 * HMAC-signed state is the primary CSRF protection.
 * Cookie double-submit is enforced only when the browser sends the cookie.
 */
export function validateOAuthRequest(state, req) {
  const payload = verifyOAuthState(state);
  if (!payload?.userId) {
    return { valid: false, code: "OAUTH_STATE_INVALID", payload: null };
  }

  const cookieState = parseCookies(req).github_oauth_state;
  if (cookieState && cookieState !== state) {
    return { valid: false, code: "OAUTH_STATE_COOKIE_MISMATCH", payload: null };
  }

  return { valid: true, code: null, payload, cookiePresent: Boolean(cookieState) };
}

function encryptionKey() {
  if (!process.env.GITHUB_TOKEN_ENCRYPTION_KEY) {
    throw new Error("GitHub token encryption key is not configured.");
  }
  return crypto
    .createHash("sha256")
    .update(process.env.GITHUB_TOKEN_ENCRYPTION_KEY)
    .digest();
}

export function encryptToken(token) {
  if (typeof token !== "string" || !token) {
    throw new Error("Invalid GitHub token.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptToken(value) {
  const parts = typeof value === "string" ? value.split(".") : [];
  if (parts.length !== 3) {
    throw new Error("Stored GitHub connection is invalid.");
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(parts[0], "base64")
    );
    decipher.setAuthTag(Buffer.from(parts[1], "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Stored GitHub connection can no longer be decrypted.");
  }
}

export function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const i = part.indexOf("=");
        return i < 0
          ? [part, ""]
          : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
      })
  );
}

export function setCookie(res, name, value, options = {}) {
  const secure =
    options.secure !== undefined
      ? options.secure
      : process.env.NODE_ENV === "production" ||
        Boolean(process.env.VERCEL);

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${options.sameSite || "Lax"}`,
  ];

  if (secure) parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);

  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearCookie(res, name) {
  setCookie(res, name, "", { maxAge: 0 });
}

/** Normalize GitHub scopes from header (comma) or token response (space). */
export function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    return [...new Set(scopes.map((scope) => String(scope).trim()).filter(Boolean))];
  }

  return [
    ...new Set(
      String(scopes || "")
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    ),
  ];
}

export function hasRepoScope(scopes) {
  return normalizeScopes(scopes).includes("repo");
}

export function missingRequiredScopes(scopes) {
  const normalized = new Set(normalizeScopes(scopes));
  return REQUIRED_GITHUB_SCOPES.filter((scope) => !normalized.has(scope));
}

export function githubHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    ...extra,
  };
}

export async function readGithubResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: "GitHub returned an unexpected response." };
  }
}

export function githubError(response, body) {
  if (response.status === 401) {
    return [
      401,
      "GITHUB_AUTH_INVALID",
      "GitHub authorization has expired. Reconnect GitHub and try again.",
    ];
  }

  if (
    response.status === 403 &&
    response.headers.get("x-ratelimit-remaining") === "0"
  ) {
    return [
      429,
      "GITHUB_RATE_LIMITED",
      "GitHub rate limit reached. Please try again later.",
    ];
  }

  const message = body?.message || "";

  if (
    response.status === 403 &&
    /resource not accessible by integration/i.test(message)
  ) {
    return [
      403,
      "GITHUB_APP_PERMISSIONS",
      "GitHub denied this operation. Use a classic OAuth App (not a GitHub App) with the repo scope, then disconnect, revoke the app under GitHub Settings → Applications, and reconnect.",
    ];
  }

  if (response.status === 403) {
    return [403, "GITHUB_FORBIDDEN", message || "GitHub denied this operation."];
  }
  if (response.status === 404) {
    return [
      404,
      "GITHUB_NOT_FOUND",
      "The selected repository or branch was not found.",
    ];
  }
  if (response.status === 409) {
    return [409, "GITHUB_CONFLICT", message || "GitHub reported a conflict."];
  }
  if (response.status === 422) {
    return [
      422,
      "GITHUB_VALIDATION",
      message || "GitHub rejected the request.",
    ];
  }

  return [
    502,
    "GITHUB_API_ERROR",
    message || "GitHub could not complete the request.",
  ];
}

export async function getConnection(userId) {
  const { data, error } = await getAdminSupabase()
    .from("github_connections")
    .select(
      "access_token, github_id, github_login, github_avatar_url, scope, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Read the scopes actually granted to a token.
 * Prefer X-OAuth-Scopes; fall back to stored scope / token exchange scope.
 */
export async function getGrantedScopes(accessToken, fallbackScopes = "") {
  const response = await fetch("https://api.github.com/user", {
    headers: githubHeaders(accessToken),
  });
  const body = await readGithubResponse(response);
  const headerScopes = response.headers.get("x-oauth-scopes");
  const scopes = normalizeScopes(
    headerScopes !== null && headerScopes !== undefined
      ? headerScopes
      : fallbackScopes
  );

  return { response, body, scopes: scopes.join(", "), scopeList: scopes };
}

/**
 * Revoke the user's OAuth grant for this app so the next connect
 * must re-consent and can receive the requested scopes.
 */
export async function revokeGitHubGrant(accessToken) {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !accessToken) {
    return { revoked: false };
  }

  const credentials = Buffer.from(
    `${GITHUB_CLIENT_ID}:${GITHUB_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await fetch(
      `https://api.github.com/applications/${GITHUB_CLIENT_ID}/grant`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      }
    );

    // 204 = revoked, 404 = already gone — both are fine for reconnect.
    if (response.status === 204 || response.status === 404) {
      return { revoked: true };
    }

    return { revoked: false, status: response.status };
  } catch {
    return { revoked: false };
  }
}

export function repoScopeRequiredError() {
  return [
    403,
    "GITHUB_REPO_SCOPE_REQUIRED",
    "GitHub repository permission is missing. Disconnect GitHub here, then open GitHub Settings → Applications → Authorized OAuth Apps, revoke this app, and reconnect while approving repository access.",
  ];
}

export function validateRepositoryName(name) {
  return typeof name === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(name);
}

export function validateRepositoryFullName(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
  );
}

export function validateBranch(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    !/[\s~^:?*[\]\\]/.test(value) &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    !value.endsWith("/")
  );
}

export function isSafeBuilderReturnTo(value) {
  return (
    typeof value === "string" &&
    /^\/builder\/[A-Za-z0-9-]+(?:\?[^#]*)?(?:#.*)?$/.test(value)
  );
}

/** Allow only same-origin relative app routes (no open redirects). */
export function isSafeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return false;
  if (value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return false;
  }
  return (
    value === "/dashboard" ||
    isSafeBuilderReturnTo(value)
  );
}

export function resolveReturnTo(value, fallback = "/dashboard") {
  return isSafeReturnTo(value) ? value : fallback;
}
