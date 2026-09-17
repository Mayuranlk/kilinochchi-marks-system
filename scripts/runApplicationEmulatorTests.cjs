const http = require("node:http");
const { spawn, spawnSync } = require("node:child_process");

const workspace = require("node:path").resolve(__dirname, "..");

function runNode(args, env = process.env) {
  return spawnSync(process.execPath, args, {
    cwd: workspace,
    env,
    stdio: "inherit",
  });
}

function waitForServer(url, timeoutMs = 15_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) return resolve();
        retry();
      });
      request.on("error", retry);
      request.setTimeout(1_000, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Application test server did not become ready at ${url}.`));
        return;
      }
      setTimeout(attempt, 200);
    };
    attempt();
  });
}

async function main() {
  const seed = runNode(["scripts/seedApplicationEmulator.cjs"]);
  if (seed.status !== 0) process.exit(seed.status ?? 1);

  const server = spawn(process.execPath, ["scripts/serveApplicationBuild.cjs"], {
    cwd: workspace,
    env: process.env,
    stdio: "inherit",
  });

  let exitCode = 1;
  try {
    await waitForServer("http://127.0.0.1:3100");
    const tests = runNode(
      ["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.emulator.config.cjs"],
      { ...process.env, PLAYWRIGHT_REUSE_APP_SERVER: "true" }
    );
    exitCode = tests.status ?? 1;
  } finally {
    server.kill();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
