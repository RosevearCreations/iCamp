import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply database migrations.");
}

const migrationDirectory = join(process.cwd(), "database", "migrations");
const migrationPattern = /^(\d{4})_([a-z0-9_]+)\.sql$/;

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(args, options = {}) {
  return execFileSync(
    "psql",
    [
      "-X",
      "--no-psqlrc",
      "-v",
      "ON_ERROR_STOP=1",
      ...args,
      databaseUrl,
    ],
    {
      encoding: "utf8",
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    },
  );
}

psql([
  "-c",
  [
    "create schema if not exists icamp_meta;",
    "create table if not exists icamp_meta.schema_migrations (",
    "version text primary key,",
    "name text not null,",
    "checksum_sha256 text not null,",
    "applied_at timestamptz not null default statement_timestamp()",
    ");",
  ].join(" "),
]);

const files = (await readdir(migrationDirectory))
  .filter((file) => migrationPattern.test(file))
  .sort();

if (files.length === 0) {
  throw new Error("No database migrations were found.");
}

for (const file of files) {
  const match = migrationPattern.exec(file);

  if (!match) {
    continue;
  }

  const [, version, name] = match;
  const filePath = join(migrationDirectory, file);
  const contents = await readFile(filePath);
  const checksum = createHash("sha256").update(contents).digest("hex");

  const existing = psql(
    [
      "--tuples-only",
      "--no-align",
      "-c",
      `select checksum_sha256 from icamp_meta.schema_migrations where version = ${sqlLiteral(version)};`,
    ],
    { capture: true },
  ).trim();

  if (existing) {
    if (existing !== checksum) {
      throw new Error(
        `Migration ${file} was previously applied with a different checksum.`,
      );
    }

    process.stdout.write(`Already applied: ${file}\n`);
    continue;
  }

  process.stdout.write(`Applying: ${file}\n`);
  psql(["--single-transaction", "-f", filePath]);

  psql([
    "-c",
    [
      "insert into icamp_meta.schema_migrations",
      "(version, name, checksum_sha256)",
      "values",
      `(${sqlLiteral(version)}, ${sqlLiteral(name)}, ${sqlLiteral(checksum)});`,
    ].join(" "),
  ]);
}

process.stdout.write(
  `Applied/verified ${files.length} migration(s). Last: ${basename(files.at(-1))}\n`,
);
