export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { assertRuntimeConfig } = await import("@/lib/config/runtime");

  assertRuntimeConfig();
}
