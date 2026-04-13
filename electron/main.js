const { app, BrowserWindow } = require("electron");
const { fork } = require("child_process");
const http = require("http");
const path = require("path");

let mainWindow;
let backendProcess;
let frontendProcess;

const FRONTEND_URL = "http://localhost:3000";

function startEmbeddedBackend() {
  const backendEntry = path.join(__dirname, "../backend/server.js");
  backendProcess = fork(backendEntry, {
    env: {
      ...process.env,
      RUNNING_IN_ELECTRON: "1",
    },
    stdio: "ignore",
  });

  backendProcess.on("exit", () => {
    backendProcess = null;
  });
}

function startEmbeddedFrontend() {
  const frontendEntry = path.join(__dirname, "../frontend/start-next.js");
  frontendProcess = fork(frontendEntry, {
    cwd: path.join(__dirname, "../frontend"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      FRONTEND_PORT: "3000",
      HOSTNAME: "localhost",
    },
    stdio: "ignore",
  });

  frontendProcess.on("exit", () => {
    frontendProcess = null;
  });
}

function waitForFrontend(url, maxAttempts = 40, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const probe = () => {
      attempts += 1;
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error("Embedded frontend did not start in time."));
          return;
        }
        setTimeout(probe, intervalMs);
      });

      req.setTimeout(1500, () => {
        req.destroy(new Error("Frontend probe timeout"));
      });
    };

    probe();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    startEmbeddedBackend();
    startEmbeddedFrontend();
    waitForFrontend(FRONTEND_URL)
      .then(createWindow)
      .catch(() => {
        createWindow();
      });
    return;
  }

  createWindow();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendProcess) {
    frontendProcess.kill();
  }
});