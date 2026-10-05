import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to verify the database.");
}

const verifyDirectory = join(process.cwd(), "database", "verify");
const files = (await readdir(verifyDirectory))
  .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
  .sort();

if (files.length === 0) {
  throw new Error("No database verification files were found.");
}

for (const file of files) {
  process.stdout.write(`Verifying: ${file}\n`);

  execFileSync(
    "psql",
    [
      "-X",
      "--no-psqlrc",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      join(verifyDirectory, file),
      databaseUrl,
    ],
    { stdio: "inherit" },
  );
}

process.stdout.write(`Verified ${files.length} database verification file(s).\n`);
