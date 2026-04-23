const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const FRONTEND_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.resolve(FRONTEND_DIR, "..", "backend");
const BACKEND_URL = process.env.SENTIRION_BACKEND_URL || "http://127.0.0.1:3001";
const HEALTH_URL = `${BACKEND_URL.replace(/\/$/, "")}/health`;
const PYTHON_BIN = process.env.SENTIRION_PYTHON_BIN || "python3";

let backendProcess = null;
let frontendProcess = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBackendHealthy() {
  return new Promise((resolve) => {
    const request = http.get(HEALTH_URL, (response) => {
      resolve(response.statusCode === 200);
      response.resume();
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(timeoutMs = 60000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendHealthy()) {
      return true;
    }
    await wait(500);
  }

  return false;
}

function startBackend() {
  backendProcess = spawn(PYTHON_BIN, ["app.py"], {
    cwd: BACKEND_DIR,
    stdio: "inherit",
    env: process.env,
  });

  backendProcess.on("exit", (code) => {
    backendProcess = null;
    if (frontendProcess && code !== 0) {
      console.error(`Sentirion backend exited with code ${code}.`);
    }
  });
}

function startFrontend() {
  const nextBin = require.resolve("next/dist/bin/next");

  frontendProcess = spawn(process.execPath, [nextBin, "dev", "--turbopack"], {
    cwd: FRONTEND_DIR,
    stdio: "inherit",
    env: process.env,
  });

  frontendProcess.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
}

function shutdown() {
  if (frontendProcess && !frontendProcess.killed) {
    frontendProcess.kill("SIGINT");
  }

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGINT");
  }
}

async function main() {
  const backendAlreadyRunning = await isBackendHealthy();

  if (!backendAlreadyRunning) {
    console.log("Starting Sentirion backend...");
    startBackend();

    const healthy = await waitForBackend();
    if (!healthy) {
      shutdown();
      console.error("Sentirion backend did not become healthy in time.");
      process.exit(1);
    }
  } else {
    console.log("Sentirion backend already running.");
  }

  console.log("Starting frontend...");
  startFrontend();
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

main().catch((error) => {
  shutdown();
  console.error(error);
  process.exit(1);
});
