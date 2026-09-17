import assert from "node:assert/strict";
import test from "node:test";
import { buildGitHubExportFiles } from "../../src/lib/githubExport.js";

test("buildGitHubExportFiles links css and js and escapes title", () => {
  const files = buildGitHubExportFiles(
    'Site <script>"x"&',
    "<h1>Hello</h1>",
    "body{color:red}",
    "console.log(1)"
  );

  assert.equal(
    files["index.html"].includes('href="style.css"'),
    true
  );
  assert.equal(
    files["index.html"].includes('src="script.js"'),
    true
  );
  assert.equal(
    files["index.html"].includes("<h1>Hello</h1>"),
    true
  );
  assert.equal(
    files["index.html"].includes(
      "<title>Site &lt;script&gt;&quot;x&quot;&amp;</title>"
    ),
    true
  );
  assert.equal(files["style.css"], "body{color:red}");
  assert.equal(files["script.js"], "console.log(1)");
});
