import assert from "node:assert/strict";
import test from "node:test";

process.env.GITHUB_OAUTH_STATE_SECRET =
  process.env.GITHUB_OAUTH_STATE_SECRET ||
  "test-oauth-state-secret-for-unit-tests";

const {
  createOAuthState,
  hasRepoScope,
  normalizeScopes,
  missingRequiredScopes,
  validateBranch,
  validateOAuthRequest,
  validateRepositoryFullName,
  validateRepositoryName,
  verifyOAuthState,
} = await import("./_utils.js");

test("normalizeScopes handles comma and space separators", () => {
  assert.deepEqual(normalizeScopes("repo, user"), ["repo", "user"]);
  assert.deepEqual(normalizeScopes("repo gist"), ["repo", "gist"]);
  assert.deepEqual(normalizeScopes([" repo ", "", "repo"]), ["repo"]);
});

test("hasRepoScope requires classic repo scope", () => {
  assert.equal(hasRepoScope("repo"), true);
  assert.equal(hasRepoScope("repo, workflow"), true);
  assert.equal(hasRepoScope("public_repo"), false);
  assert.equal(hasRepoScope(""), false);
  assert.equal(hasRepoScope("read:user"), false);
});

test("missingRequiredScopes reports repo when absent", () => {
  assert.deepEqual(missingRequiredScopes(""), ["repo"]);
  assert.deepEqual(missingRequiredScopes("repo"), []);
});

test("OAuth state round-trips and rejects tampering", () => {
  const state = createOAuthState("user-123", "/builder/abc");
  const payload = verifyOAuthState(state);
  assert.equal(payload.userId, "user-123");
  assert.equal(payload.returnTo, "/builder/abc");
  const lastDot = state.lastIndexOf(".");
  const signature = state.slice(lastDot + 1);
  const flipped = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(verifyOAuthState(`${state.slice(0, lastDot + 1)}${flipped}`), null);
  assert.equal(verifyOAuthState("not-valid"), null);
});

test("validateOAuthRequest accepts signed state without cookie", () => {
  const state = createOAuthState("user-123", "/builder/abc");
  const result = validateOAuthRequest(state, { headers: {} });
  assert.equal(result.valid, true);
  assert.equal(result.payload.userId, "user-123");
});

test("validateOAuthRequest rejects cookie mismatch", () => {
  const state = createOAuthState("user-123", "/builder/abc");
  const result = validateOAuthRequest(state, {
    headers: { cookie: "github_oauth_state=other-state" },
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, "OAUTH_STATE_COOKIE_MISMATCH");
});

test("repository and branch validators", () => {
  assert.equal(validateRepositoryName("my-site"), true);
  assert.equal(validateRepositoryName("../etc"), false);
  assert.equal(validateRepositoryFullName("octocat/Hello-World"), true);
  assert.equal(validateRepositoryFullName("octocat"), false);
  assert.equal(validateBranch("main"), true);
  assert.equal(validateBranch("feature/x"), true);
  assert.equal(validateBranch("../main"), false);
  assert.equal(validateBranch("has space"), false);
});
