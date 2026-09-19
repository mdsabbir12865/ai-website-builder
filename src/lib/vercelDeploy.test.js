import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVercelExportFiles,
  deploymentPhaseLabel,
  humanizeVercelError,
  isTerminalDeploymentState,
  sanitizeVercelProjectName,
} from "./vercelDeploy.js";

test("buildVercelExportFiles creates linked static assets", () => {
  const files = buildVercelExportFiles("Demo", "<h1>Hi</h1>", "h1{color:red}", "1");
  assert.match(files["index.html"], /href="style\.css"/);
  assert.match(files["index.html"], /src="script\.js"/);
  assert.match(files["index.html"], /<h1>Hi<\/h1>/);
  assert.equal(files["style.css"], "h1{color:red}");
  assert.equal(files["script.js"], "1");
});

test("sanitizeVercelProjectName produces valid names", () => {
  assert.equal(sanitizeVercelProjectName("Hello World"), "hello-world");
  assert.equal(sanitizeVercelProjectName("!!!"), "website");
});

test("deployment helpers", () => {
  assert.equal(isTerminalDeploymentState("READY"), true);
  assert.equal(isTerminalDeploymentState("BUILDING"), false);
  assert.match(deploymentPhaseLabel("building"), /Building/i);
  assert.match(
    humanizeVercelError("TOKEN_INVALID"),
    /reconnect/i
  );
});
