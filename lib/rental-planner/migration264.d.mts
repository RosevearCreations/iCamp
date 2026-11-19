export const RENTAL_MIGRATIONS264: readonly {
  readonly version: string;
  readonly name: string;
  readonly checksumSha256: string;
}[];
export interface RentalMigrationStatus264 {
  status: string;
  sourceReadbackMatched: boolean;
  independentHostCustodyCertified: false;
  signedExternalWitnessConfirmed: false;
  financesActivated: false;
  allocationsOperationallyProven: false;
  blockers: string[];
  checkedVersions: string[];
}
export function assessRentalMigrationReadback264(input: {
  production: boolean;
  pinnedDatabaseHost: boolean;
  revision: string | null;
  readSucceeded: boolean;
  rows?: Array<{ version: string; name: string; checksum_sha256: string }>;
  tables?: Array<{
    name: string;
    forceRls: boolean;
    guardPresent: boolean;
    appDirectGrants: boolean;
    guardName: string;
  }>;
}): RentalMigrationStatus264;
