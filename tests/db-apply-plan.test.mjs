import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function runPlan(args) {
  const result = spawnSync("node", ["scripts/db-apply.mjs", ...args], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("pilot plan includes schema and baseline only", () => {
  const output = runPlan(["--mode", "pilot"]);

  assert.match(output, /001-initial-schema\.sql/);
  assert.match(output, /001-pilot-baseline\.sql/);
  assert.doesNotMatch(output, /002-demo-data\.sql/);
  assert.match(output, /Dry run only/);
});

test("demo plan includes optional demo seed", () => {
  const output = runPlan(["--mode", "demo", "--local"]);

  assert.match(output, /001-initial-schema\.sql/);
  assert.match(output, /001-pilot-baseline\.sql/);
  assert.match(output, /002-demo-data\.sql/);
  assert.match(output, /--local/);
});
