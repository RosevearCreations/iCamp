/** Only known Sysop destinations may survive the MFA return flow. */
export function sysopReturnPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/auth/account";
  }
  try {
    const parsed = new URL(value, "https://icamp.invalid");
    if (parsed.origin !== "https://icamp.invalid") return "/auth/account";
    if (parsed.search || parsed.hash) return "/auth/account";
    if (parsed.pathname !== "/sysop" && parsed.pathname !== "/platform") {
      return "/auth/account";
    }
    return parsed.pathname;
  } catch {
    return "/auth/account";
  }
}
