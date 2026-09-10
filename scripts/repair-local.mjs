import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
rmSync(resolve(root, ".next"), { recursive: true, force: true });
console.log("[SocialFlow] Cleared the Next.js development cache.");

const node = process.execPath;
const result = spawnSync(node, [resolve(root, "scripts", "local-setup.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
