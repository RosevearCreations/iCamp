import { createHash } from "node:crypto";

/** These SHA-256 digests are of canonical migration SQL *file bytes* (not Git
 * blob SHA-1). Recorded from reviewed iCamp Git sources; tests re-hash each
 * source file on every protected CI run to reject manifest drift. */
export const BUILD253_CANONICAL_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: "0231",
    name: "build247_device_calibration_dossier_continuity",
    path: "database/migrations/0231_build247_device_calibration_dossier_continuity.sql",
    sha256: "2fed697cbfa6bd1e81212a4efdf920a863553c9fc4d1980f7eca92b115935993",
    gitBlobSha1: "cb64e4e1ebe1052a5c89496fa0a557f8aa63bb04",
  }),
  Object.freeze({
    version: "0232",
    name: "build249_original_device_witness",
    path: "database/migrations/0232_build249_original_device_witness.sql",
    sha256: "d97fa7c12e29028e2a39e11469cc36c856a6def2c9ecd146ef969808671d2ce7",
    gitBlobSha1: "7b877772eea6bdca8e7803975018938fdd97a602",
  }),
  Object.freeze({
    version: "0233",
    name: "build250_owner_supervised_ceremony",
    path: "database/migrations/0233_build250_owner_supervised_ceremony.sql",
    sha256: "f338d9b37c8fcbc371511489389dbc5ac197df0127d75c82625c22e9147de15d",
    gitBlobSha1: "8819ec4597f826e1c7f0bca167f0389e2d84ea37",
  }),
]);
export function canonicalMigrationManifestDigest() {
  const canonical = BUILD253_CANONICAL_MIGRATIONS.map(
    ({ version, name, sha256 }) => [version, name, sha256],
  );
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
