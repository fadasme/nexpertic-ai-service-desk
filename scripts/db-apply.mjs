import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifestUrl = new URL("lib/nexera/persistence/migrations.json", root);
const persistenceDir = new URL("lib/nexera/persistence/", root);

function usage() {
  return [
    "Usage:",
    "  npm run db:plan:pilot",
    "  npm run db:plan:demo",
    "  node scripts/db-apply.mjs --mode pilot --database <d1-name-or-id> --execute",
    "  node scripts/db-apply.mjs --mode demo --database <d1-name-or-id> --local --execute",
    "",
    "Modes:",
    "  pilot  applies schema + clean pilot baseline",
    "  demo   applies schema + baseline + optional demo data",
  ].join("\n");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const mode = argValue("--mode") ?? "pilot";
const database = argValue("--database") ?? process.env.NEXERA_D1_DATABASE;
const execute = process.argv.includes("--execute");
const local = process.argv.includes("--local");

if (!["pilot", "demo"].includes(mode)) {
  console.error(`Invalid mode: ${mode}\n\n${usage()}`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const migrationFiles = manifest.migrations.map((migration) => migration.file);
const seedFiles = mode === "pilot"
  ? ["seeds/001-pilot-baseline.sql"]
  : ["seeds/001-pilot-baseline.sql", "seeds/002-demo-data.sql"];
const files = [...migrationFiles, ...seedFiles];

for (const file of files) {
  const url = new URL(file, persistenceDir);
  if (!existsSync(url)) {
    console.error(`Missing SQL file: ${file}`);
    process.exit(1);
  }
}

const commands = files.map((file) => [
  "npx",
  "wrangler",
  "d1",
  "execute",
  database ?? "<D1_DATABASE_NAME_OR_ID>",
  local ? "--local" : "--remote",
  "--file",
  `lib/nexera/persistence/${file}`,
]);

console.log(`Nexpertic D1 ${execute ? "apply" : "plan"} (${mode})`);
console.log("");
commands.forEach((command) => console.log(command.join(" ")));

if (!execute) {
  console.log("");
  console.log("Dry run only. Add --execute and --database <name-or-id> to apply.");
  process.exit(0);
}

if (!database) {
  console.error("\nMissing --database <name-or-id> or NEXERA_D1_DATABASE.");
  process.exit(1);
}

for (const command of commands) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: new URL("../", import.meta.url),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
