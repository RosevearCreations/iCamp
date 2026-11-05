export function build203AuthorizedCampgrounds(actor: string): Promise<
  Array<{
    campgroundId: string;
    campgroundName: string;
    canReview: boolean;
    canAuthorize: boolean;
  }>
>;
export function listBuild203Review(
  actor: string,
  campgroundId: string,
): Promise<
  ReturnType<typeof import("./build203-custody.mjs").build203ReviewReadback>
>;
export function recordBuild203Custody(
  actor: string,
  raw: unknown,
): Promise<{
  id: string;
  submittedAt: string;
  disposition: string;
  connection_state: string;
}>;
export function recordBuild203OwnerIntent(
  actor: string,
  raw: unknown,
): Promise<{
  id: string;
  submittedAt: string;
  disposition: string;
  connection_state: string;
}>;
