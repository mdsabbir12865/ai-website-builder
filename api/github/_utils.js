import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID;

export const GITHUB_CLIENT_SECRET =
  process.env.GITHUB_CLIENT_SECRET;

export const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  "https://ms-do.vercel.app/api/github/callback";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getAdminSupabase() {
  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL.");
  }

  if (!SUPABASE_KEY) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function getBearerToken(req) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim() || null;
}

export async function getSupabaseUser(req) {
  const accessToken =
    getBearerToken(req);

  if (!accessToken) {
    return null;
  }

  const supabase = createClient(
    SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(
    accessToken
  );

  if (error || !user) {
    return null;
  }

  return user;
}

export function getCookie(req, name) {
  const cookies = req.headers.cookie || "";
  const prefix = `${name}=`;
  const match = cookies.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export function githubHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

export function scopesFromResponse(response) {
  return (response.headers.get("x-oauth-scopes") || "")
    .split(",").map((scope) => scope.trim()).filter(Boolean);
}

export async function getGithubConnection(userId) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from("github_connections")
    .select("access_token, github_login, scope").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.access_token) return null;
  return { ...data, accessToken: decryptToken(data.access_token) };
}

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64url(value) {
  return Buffer.from(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

function getOAuthSecret() {
  const secret =
    process.env.GITHUB_OAUTH_STATE_SECRET;

  if (!secret) {
    throw new Error(
      "Missing GITHUB_OAUTH_STATE_SECRET."
    );
  }

  return secret;
}
export function createOAuthState(
  userId,
  returnTo = "/dashboard"
) {
  const payload = {
    userId,
    returnTo,
    nonce: crypto.randomBytes(32).toString("hex"),
    createdAt: Date.now(),
  };

  const encoded = base64url(
    JSON.stringify(payload)
  );

  const signature =
    crypto
      .createHmac(
        "sha256",
        getOAuthSecret()
      )
      .update(encoded)
      .digest("hex");

  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state) {
  if (!state || !state.includes(".")) {
    return null;
  }

  const [encoded, signature] =
    state.split(".");

  const expected =
    crypto
      .createHmac(
        "sha256",
        getOAuthSecret()
      )
      .update(encoded)
      .digest("hex");

  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  let payload;
  try { payload = JSON.parse(fromBase64url(encoded)); } catch { return null; }

  const age =
    Date.now() - payload.createdAt;

  if (!payload.createdAt || age < 0 || age > 10 * 60 * 1000) {
    return null;
  }

  return payload;
}

function getEncryptionKey() {
  const raw =
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "Missing GITHUB_TOKEN_ENCRYPTION_KEY."
    );
  }

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest();
}

export function encryptToken(token) {
  const key = getEncryptionKey();

  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptToken(value) {
  const [
    ivBase64,
    tagBase64,
    encryptedBase64,
  ] = value.split(".");

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivBase64, "base64")
    );

  decipher.setAuthTag(
    Buffer.from(tagBase64, "base64")
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(
        encryptedBase64,
        "base64"
      )
    ),
    decipher.final(),
  ]).toString("utf8");
}

export function setCookie(
  res,
  name,
  value,
  options = {}
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
  ];

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.secure !== false) {
    parts.push("Secure");
  }

  parts.push(
    `SameSite=${options.sameSite || "Lax"}`
  );

  if (options.maxAge !== undefined) {
    parts.push(
      `Max-Age=${options.maxAge}`
    );
  }

  res.setHeader(
    "Set-Cookie",
    parts.join("; ")
  );
}

export function clearCookie(
  res,
  name
) {
  setCookie(
    res,
    name,
    "",
    {
      maxAge: 0,
    }
  );
}
