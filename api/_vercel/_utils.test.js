import assert from "node:assert/strict";
import test from "node:test";

process.env.VERCEL_OAUTH_STATE_SECRET =
  process.env.VERCEL_OAUTH_STATE_SECRET ||
  "test-vercel-oauth-state-secret-for-unit-tests";
process.env.VERCEL_TOKEN_ENCRYPTION_KEY =
  process.env.VERCEL_TOKEN_ENCRYPTION_KEY ||
  "test-vercel-token-encryption-key-for-unit-tests";

const {
  buildDeploymentFiles,
  createOAuthState,
  encryptToken,
  decryptToken,
  isSafeReturnTo,
  isSafeVercelNextUrl,
  mapReadyStateToPhase,
  sanitizeProjectName,
  validateOAuthRequest,
  validateProjectName,
  verifyOAuthState,
} = await import("./_utils.js");

test("OAuth state round-trips and rejects tampering", () => {
  const state = createOAuthState("user-123", "/builder/abc");
  const payload = verifyOAuthState(state);
  assert.equal(payload.userId, "user-123");
  assert.equal(payload.returnTo, "/builder/abc");
  const lastDot = state.lastIndexOf(".");
  const signature = state.slice(lastDot + 1);
  const flipped = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(verifyOAuthState(`${state.slice(0, lastDot + 1)}${flipped}`), null);
});

test("validateOAuthRequest accepts signed state without cookie", () => {
  const state = createOAuthState("user-123", "/builder/abc");
  const result = validateOAuthRequest(state, { headers: {} });
  assert.equal(result.valid, true);
});

test("validateOAuthRequest rejects cookie mismatch", () => {
  const state = createOAuthState("user-123", "/builder/abc");
  const result = validateOAuthRequest(state, {
    headers: { cookie: "vercel_oauth_state=other-state" },
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, "OAUTH_STATE_COOKIE_MISMATCH");
});

test("token encrypt/decrypt round-trip", () => {
  const token = "vercel-access-token-example";
  const encrypted = encryptToken(token);
  assert.notEqual(encrypted, token);
  assert.equal(decryptToken(encrypted), token);
});

test("safe return and next URL validators", () => {
  assert.equal(isSafeReturnTo("/builder/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"), true);
  assert.equal(isSafeReturnTo("https://evil.com"), false);
  assert.equal(isSafeVercelNextUrl("https://vercel.com/dashboard"), true);
  assert.equal(isSafeVercelNextUrl("https://evil.com"), false);
});

test("project name sanitization", () => {
  assert.equal(sanitizeProjectName("My Cool Site!"), "my-cool-site");
  assert.equal(validateProjectName("my-cool-site"), true);
  assert.equal(validateProjectName("My Site"), false);
});

test("buildDeploymentFiles encodes static site files", () => {
  const files = buildDeploymentFiles({
    "index.html": "<html></html>",
    "style.css": "body{}",
    "script.js": "console.log(1)",
  });
  assert.equal(files.length, 3);
  assert.equal(files[0].file, "index.html");
  assert.equal(files[0].encoding, "base64");
  assert.ok(files[0].data.length > 0);
});

test("mapReadyStateToPhase covers Vercel states", () => {
  assert.equal(mapReadyStateToPhase("BUILDING"), "building");
  assert.equal(mapReadyStateToPhase("READY"), "ready");
  assert.equal(mapReadyStateToPhase("ERROR"), "failed");
});
