/**
 * SocialFlow server instrumentation.
 *
 * Development mode automatically runs a small embedded scheduler in the same
 * Node.js process, so scheduled posts publish even if no browser tab is open.
 * The Windows launchers also explicitly enable it. Production Docker keeps the
 * embedded scheduler off and uses the dedicated scheduler service instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const explicitlyDisabled = process.env.SOCIALFLOW_EMBEDDED_SCHEDULER === "0";
  const explicitlyEnabled = process.env.SOCIALFLOW_EMBEDDED_SCHEDULER === "1";
  const enabledInDevelopment = process.env.NODE_ENV !== "production" && !explicitlyDisabled;
  if (!explicitlyEnabled && !enabledInDevelopment) return;

  await import("./lib/embedded-scheduler");
}
