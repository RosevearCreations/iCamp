export interface IvrTransitionResult {
  fromState: string;
  toState: string;
  action: string;
  eventType: string;
  retryCount: number;
  sessionState: "active" | "transferred" | "completed" | "failed";
}

export const DEFAULT_IVR_MAX_RETRIES: number;
export const DEFAULT_IVR_SESSION_SECONDS: number;

export function transitionIvrState(input: {
  stateKey: string;
  eventType: string;
  retryCount?: number;
  maxRetries?: number;
  definition?: Record<
    string,
    Record<
      string,
      {
        toState: string;
        action: string;
        terminal?: boolean;
        retry?: boolean;
      }
    >
  >;
}): IvrTransitionResult;
