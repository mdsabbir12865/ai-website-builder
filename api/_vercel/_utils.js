import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const VERCEL_INTEGRATION_CLIENT_ID =
  process.env.VERCEL_INTEGRATION_CLIENT_ID;
export const VERCEL_INTEGRATION_CLIENT_SECRET =
  process.env.VERCEL_INTEGRATION_CLIENT_SECRET;
export const VERCEL_INTEGRATION_REDIRECT_URI =
  process.env.VERCEL_INTEGRATION_REDIRECT_URI ||
  "https://ms-do.vercel.app/api/vercel/callback";
export const VERCEL_INTEGRATION_SLUG = process.env.VERCEL_INTEGRATION_SLUG;

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_FILE_BYTES = 1024 * 1024;
const DEPLOY_LOCK_MS = 3 * 60 * 1000;

export const TERMINAL_DEPLOYMENT_STATES = new Set([
  "READY",
  "ERROR",
  "CANCELED",
]);

export function sendError(res, status, code, error) {
  return res.status(status).json({ success: false, code, error });
}

export function getAdminSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Vercel integration server configuration is incomplete.");
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
  if (!process.env.VERCEL_OAUTH_STATE_SECRET) {
    throw new Error("Vercel OAuth state secret is not configured.");
  }
  return process.env.VERCEL_OAUTH_STATE_SECRET;
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

export function validateOAuthRequest(state, req) {
  const payload = verifyOAuthState(state);
  if (!payload?.userId) {
    return { valid: false, code: "OAUTH_STATE_INVALID", payload: null };
  }

  const cookieState = parseCookies(req).vercel_oauth_state;
  if (cookieState && cookieState !== state) {
    return { valid: false, code: "OAUTH_STATE_COOKIE_MISMATCH", payload: null };
  }

  return { valid: true, code: null, payload, cookiePresent: Boolean(cookieState) };
}

function encryptionKey() {
  if (!process.env.VERCEL_TOKEN_ENCRYPTION_KEY) {
    throw new Error("Vercel token encryption key is not configured.");
  }
  return crypto
    .createHash("sha256")
    .update(process.env.VERCEL_TOKEN_ENCRYPTION_KEY)
    .digest();
}

export function encryptToken(token) {
  if (typeof token !== "string" || !token) {
    throw new Error("Invalid Vercel token.");
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
    throw new Error("Stored Vercel connection is invalid.");
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
    throw new Error("Stored Vercel connection can no longer be decrypted.");
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

export function isSafeBuilderReturnTo(value) {
  return (
    typeof value === "string" &&
    /^\/builder\/[A-Za-z0-9-]+(?:\?[^#]*)?(?:#.*)?$/.test(value)
  );
}

export function isSafeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return false;
  if (value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return false;
  }
  return value === "/dashboard" || isSafeBuilderReturnTo(value);
}

export function resolveReturnTo(value, fallback = "/dashboard") {
  return isSafeReturnTo(value) ? value : fallback;
}

/** Only allow Vercel completion URLs for the Integration `next` parameter. */
export function isSafeVercelNextUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com"))
    );
  } catch {
    return false;
  }
}

export function sanitizeProjectName(value) {
  const raw = String(value || "website")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  if (!raw || !/^[a-z0-9]/.test(raw)) {
    return `site-${crypto.randomBytes(3).toString("hex")}`;
  }
  return raw;
}

export function validateProjectName(name) {
  return (
    typeof name === "string" &&
    /^[a-z0-9][a-z0-9._-]{0,99}$/.test(name)
  );
}

export function validateVercelProjectId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function validateDeploymentId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function validateUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
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

export function vercelHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function readVercelResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: "Vercel returned an unexpected response." } };
  }
}

export function vercelError(response, body) {
  const message =
    body?.error?.message ||
    body?.message ||
    (typeof body?.error === "string" ? body.error : "") ||
    "";

  if (response.status === 401) {
    return [
      401,
      "TOKEN_INVALID",
      "Your Vercel connection has expired. Please reconnect your account.",
    ];
  }

  if (response.status === 403) {
    if (/team/i.test(message)) {
      return [
        403,
        "TEAM_ACCESS_DENIED",
        "Vercel denied access for this team. Reconnect and choose a team you can deploy to.",
      ];
    }
    return [
      403,
      "INSUFFICIENT_PERMISSION",
      message ||
        "Vercel denied this operation. Reconnect and grant project and deployment access.",
    ];
  }

  if (
    response.status === 429 ||
    /rate.?limit/i.test(message)
  ) {
    return [
      429,
      "RATE_LIMITED",
      "Vercel rate limit reached. Please wait a moment and try again.",
    ];
  }

  if (response.status === 404) {
    return [
      404,
      "PROJECT_NOT_FOUND",
      "The Vercel project or deployment was not found.",
    ];
  }

  if (response.status === 409) {
    return [
      409,
      "DUPLICATE_DEPLOYMENT",
      message || "A conflicting deployment is already in progress.",
    ];
  }

  if (response.status === 400 || response.status === 422) {
    if (/name/i.test(message)) {
      return [
        400,
        "INVALID_PROJECT_NAME",
        message || "That Vercel project name is invalid.",
      ];
    }
    return [
      400,
      "VERCEL_VALIDATION",
      message || "Vercel rejected this request.",
    ];
  }

  return [
    502,
    "VERCEL_API_ERROR",
    message || "Vercel could not complete the request.",
  ];
}

export async function vercelApi(accessToken, path, options = {}) {
  const teamId = options.teamId;
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: vercelHeaders(accessToken, options.headers),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = await readVercelResponse(response);
  return { response, body };
}

export async function getConnection(userId) {
  const { data, error } = await getAdminSupabase()
    .from("vercel_connections")
    .select(
      "access_token, configuration_id, vercel_user_id, vercel_username, vercel_avatar_url, team_id, scopes, updated_at, last_used_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function touchConnection(userId) {
  await getAdminSupabase()
    .from("vercel_connections")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function getOwnedProject(userId, projectId) {
  if (!validateUuid(projectId)) return null;

  const { data, error } = await getAdminSupabase()
    .from("projects")
    .select(
      "id, user_id, name, html_code, css_code, js_code, vercel_project_id, vercel_project_name, vercel_team_id, github_repo_full_name, github_branch, last_deployment_id, last_deployment_url, last_deployed_at, deploy_in_progress_at"
    )
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function isDeployInProgress(project) {
  if (!project?.deploy_in_progress_at) return false;
  const started = Date.parse(project.deploy_in_progress_at);
  if (!Number.isFinite(started)) return false;
  return Date.now() - started < DEPLOY_LOCK_MS;
}

export async function setDeployLock(projectId, userId, locked) {
  const { error } = await getAdminSupabase()
    .from("projects")
    .update({
      deploy_in_progress_at: locked ? new Date().toISOString() : null,
    })
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function buildDeploymentFiles(fileMap) {
  const required = ["index.html", "style.css", "script.js"];
  const files = [];

  for (const path of required) {
    const content = fileMap?.[path];
    if (typeof content !== "string") {
      throw Object.assign(new Error("Deployment files are incomplete."), {
        code: "INVALID_FILES",
      });
    }
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes === 0 && path === "index.html") {
      throw Object.assign(new Error("index.html cannot be empty."), {
        code: "INVALID_FILES",
      });
    }
    if (bytes > MAX_FILE_BYTES) {
      throw Object.assign(
        new Error(`${path} must be under 1 MB.`),
        { code: "INVALID_FILES" }
      );
    }
    files.push({
      file: path,
      data: Buffer.from(content, "utf8").toString("base64"),
      encoding: "base64",
    });
  }

  return files;
}

export function publicDeploymentUrl(deployment) {
  const host = deployment?.url || deployment?.alias?.[0] || null;
  if (!host || typeof host !== "string") return null;
  if (host.startsWith("https://") || host.startsWith("http://")) return host;
  return `https://${host}`;
}

export function mapReadyStateToPhase(readyState) {
  switch (readyState) {
    case "QUEUED":
      return "queued";
    case "INITIALIZING":
      return "initializing";
    case "BUILDING":
      return "building";
    case "READY":
      return "ready";
    case "ERROR":
      return "failed";
    case "CANCELED":
      return "canceled";
    default:
      return "deploying";
  }
}
