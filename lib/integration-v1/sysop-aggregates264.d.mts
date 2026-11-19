export interface SysopAggregates264 {
  queueDepth: number;
  jobsCompleted: number;
  jobsFailed: number;
  activeSessions: number;
  metricsWindowSeconds: 60;
  hasIndependentOriginalHostBootProof: false;
}
export function sampleSysopAggregates264(
  env?: NodeJS.ProcessEnv,
): Promise<SysopAggregates264 | null>;
