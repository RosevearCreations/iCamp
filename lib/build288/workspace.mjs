/** Classify only local path segments; this never grants permission. */
export function workspaceKind288(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "general";
  try {
    const url = new URL(value, "https://icamp.invalid");
    if (url.origin !== "https://icamp.invalid") return "general";
    const path = url.pathname;
    if (
      ["/sysop", "/platform"].some(
        (base) => path === base || path.startsWith(base + "/"),
      )
    )
      return "platform";
    if (path === "/campground" || path.startsWith("/campground/"))
      return "campground";
    if (path === "/guest" || path.startsWith("/guest/")) return "guest";
  } catch {
    return "general";
  }
  return "general";
}

export function matchesWorkspace288(workspace, accountType) {
  if (workspace === "platform" || workspace === "campground")
    return accountType === "staff";
  if (workspace === "guest") return accountType === "guest";
  return true;
}

export function workspaceSignIn288(value) {
  switch (value) {
    case "platform":
      return "/auth/login?next=%2Fsysop";
    case "campground":
      return "/auth/login?next=%2Fcampground";
    case "guest":
      return "/auth/login?next=%2Fguest%2Fhub";
    default:
      return null;
  }
}
