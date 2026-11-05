export function build202AuthorizedCampgrounds(actor: string): Promise<
  Array<{
    campgroundId: string;
    campgroundName: string;
    canReview: boolean;
    canIntake: boolean;
  }>
>;
export function listBuild202Evidence(
  actor: string,
  campgroundId: string,
): Promise<Record<string, unknown>>;
export function submitBuild202Evidence(
  actor: string,
  raw: unknown,
): Promise<{
  id: string;
  submittedAt: string;
  disposition: string;
  connection_state: string;
}>;
