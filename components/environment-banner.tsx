import { publicConfig } from "@/lib/config/public";

export function EnvironmentBanner() {
  if (publicConfig.environment === "production") {
    return null;
  }

  return (
    <div className="environment-banner" role="status">
      <strong>{publicConfig.environment.toUpperCase()}</strong>
      <span>
        Non-production environment — use synthetic/test information only.
      </span>
    </div>
  );
}
