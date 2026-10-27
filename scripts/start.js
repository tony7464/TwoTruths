const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const { serverDir, clientDir, venvPython } = require("./common");

const API_PORT = 5555;
const WEB_PORT = 5173;

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(400, () => finish(false));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefix(stream, label) {
  let pending = "";
  stream.on("data", (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) {
      process.stdout.write(`[${label}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (pending) process.stdout.write(`[${label}] ${pending}\n`);
  });
}

function killTree(child) {
  if (!child || child.pid == null) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    }
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // The process is already gone.
    }
  }
}

function busyMessage(ports) {
  const names = ports.map((port) => (port === API_PORT ? `${port} (the API)` : `${port} (the website)`));
  const subject = names.length === 1 ? `Port ${names[0]} is` : `Ports ${names.join(" and ")} are`;
  const flags = ports.map((port) => `:${port}`).join(" ");
  console.error(`${subject} already in use.`);
  console.error("Stop the program using it, then run npm start again.");
  console.error(`macOS or Linux: lsof -i ${flags}`);
  console.error(`Windows: netstat -ano | findstr ${flags}`);
}

async function main() {
  const python = venvPython();
  const clientModules = path.join(clientDir, "node_modules");
  if (!fs.existsSync(python) || !fs.existsSync(clientModules)) {
    console.error('Run "npm run setup" first.');
    process.exit(1);
  }

  const busy = [];
  if (!(await portIsFree(API_PORT))) busy.push(API_PORT);
  if (!(await portIsFree(WEB_PORT))) busy.push(WEB_PORT);
  if (busy.length) {
    busyMessage(busy);
    process.exit(1);
  }

  const spawnOptions = {
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  };
  const api = spawn(python, ["-m", "flask", "run", "--host", "127.0.0.1", "--port", String(API_PORT)], {
    ...spawnOptions,
    cwd: serverDir,
    env: {
      ...process.env,
      FLASK_APP: "app.py",
      FLASK_DEBUG: "1",
      FLASK_RUN_HOST: "127.0.0.1",
      FLASK_RUN_PORT: String(API_PORT),
      PYTHONUNBUFFERED: "1",
    },
  });
  const viteBin = path.join(clientDir, "node_modules", "vite", "bin", "vite.js");
  const web = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(WEB_PORT)], {
    ...spawnOptions,
    cwd: clientDir,
    env: process.env,
  });

  prefix(api.stdout, "api");
  prefix(api.stderr, "api");
  prefix(web.stdout, "web");
  prefix(web.stderr, "web");

  let shuttingDown = false;
  function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    killTree(api);
    killTree(web);
    setTimeout(() => process.exit(code), 400);
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  for (const [child, label] of [[api, "api"], [web, "web"]]) {
    child.on("error", (error) => {
      console.error(`[${label}] ${error.message}`);
      shutdown(1);
    });
    child.on("exit", (code, signal) => {
      if (shuttingDown) return;
      console.error(`[${label}] stopped (${signal || code}).`);
      shutdown(code || 1);
    });
  }

  const deadline = Date.now() + 60000;
  let apiUp = false;
  let webUp = false;
  while (Date.now() < deadline && !shuttingDown) {
    if (!apiUp) apiUp = await canConnect(API_PORT);
    if (!webUp) webUp = await canConnect(WEB_PORT);
    if (apiUp && webUp) {
      console.log("Open http://127.0.0.1:5173  (login: alex / password123)");
      return;
    }
    await sleep(300);
  }
  if (!shuttingDown) {
    console.error("The API or the website did not start. See the messages above.");
    shutdown(1);
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : "Start failed.");
  process.exit(1);
});
