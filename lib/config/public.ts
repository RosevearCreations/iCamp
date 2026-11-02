import type { AppEnvironment } from "@/lib/config/runtime";

function publicEnvironment(): AppEnvironment {
  const configured = process.env.NEXT_PUBLIC_APP_ENV;

  if (
    configured === "development" ||
    configured === "test" ||
    configured === "staging" ||
    configured === "production"
  ) {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const publicConfig = Object.freeze({
  appName: process.env.NEXT_PUBLIC_APP_NAME || "iCamp",
  environment: publicEnvironment(),
});
