export interface WatchdogContract {
  livenessPath: string;
  readinessPath: string;
  expectedLivenessStatus: number;
  expectedReadinessStatus: number;
  recommendedCheckSeconds: number;
  recommendedFailureThreshold: number;
}

export const watchdogContract: Readonly<WatchdogContract> = Object.freeze({
  livenessPath: "/api/health/live",
  readinessPath: "/api/health/ready",
  expectedLivenessStatus: 200,
  expectedReadinessStatus: 200,
  recommendedCheckSeconds: 60,
  recommendedFailureThreshold: 3,
});
