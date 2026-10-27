const fs = require("fs");
const path = require("path");

const { serverDir, clientDir, venvPython, npmCommand, run, capture } = require("./common");

const PYTHON_URL = "https://www.python.org/downloads/";
const NODE_URL = "https://nodejs.org/";

function parseVersion(text) {
  const match = String(text).trim().match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)];
}

function versionText(parts) {
  return parts.join(".");
}

function pythonIsNewEnough(parts) {
  return parts[0] > 3 || (parts[0] === 3 && parts[1] >= 10);
}

function nodeIsNewEnough(parts) {
  if (parts[0] === 20) return parts[1] >= 19;
  if (parts[0] === 22) return parts[1] >= 12;
  return parts[0] > 22;
}

function failPrereq(message) {
  console.error(message);
  process.exit(1);
}

async function pythonVersion(cmd, args) {
  const output = await capture(cmd, [...args, "-c", "import sys; print('%d.%d.%d' % sys.version_info[:3])"]);
  return parseVersion(output);
}

async function findPython() {
  const candidates = [
    { cmd: "python3", args: [] },
    { cmd: "python", args: [] },
    { cmd: "py", args: ["-3"] },
  ];
  let tooOld = null;
  for (const candidate of candidates) {
    let found;
    try {
      found = await pythonVersion(candidate.cmd, candidate.args);
    } catch {
      continue;
    }
    if (!found) continue;
    const reported = process.env.TT_FAKE_PYTHON_VERSION
      ? parseVersion(process.env.TT_FAKE_PYTHON_VERSION)
      : found;
    if (!reported) {
      failPrereq(`Python reported a version that could not be read. Need Python 3.10 or newer.\nGet it at ${PYTHON_URL}`);
    }
    if (pythonIsNewEnough(reported)) {
      return candidate;
    }
    if (!tooOld) tooOld = reported;
  }
  if (tooOld) {
    failPrereq(
      `Python is too old. Found ${versionText(tooOld)}. Need Python 3.10 or newer.\nGet it at ${PYTHON_URL}`,
    );
  }
  failPrereq(`Python was not found. Need Python 3.10 or newer.\nGet it at ${PYTHON_URL}`);
}

function checkNode() {
  const raw = process.env.TT_FAKE_NODE_VERSION || process.versions.node;
  const found = parseVersion(raw);
  if (!found) {
    failPrereq(`Node.js reported a version that could not be read. Need Node.js 20.19+ or 22.12+ (Vite 8).\nGet it at ${NODE_URL}`);
  }
  if (!nodeIsNewEnough(found)) {
    failPrereq(
      `Node.js is too old. Found ${versionText(found)}. Need Node.js 20.19+ or 22.12+ (Vite 8).\nGet it at ${NODE_URL}`,
    );
  }
}

async function step(label, fn) {
  console.log(label);
  try {
    await fn();
  } catch (error) {
    console.error(`Setup failed: ${label}`);
    if (error && error.message) console.error(error.message.trim());
    process.exit(1);
  }
}

async function ensureVenv(python) {
  const venv = venvPython();
  if (fs.existsSync(venv)) {
    try {
      await capture(venv, ["-c", "import sys"]);
      console.log("Using the existing one.");
      return;
    } catch {
      console.log("The existing one did not run, so it is being replaced.");
      fs.rmSync(path.join(serverDir, ".venv"), { recursive: true, force: true });
    }
  }
  await run(python.cmd, [...python.args, "-m", "venv", path.join(serverDir, ".venv")]);
}

async function main() {
  console.log("Checking Python and Node...");
  checkNode();
  const python = await findPython();

  await step("[1/5] Creating the Python environment...", () => ensureVenv(python));
  await step("[2/5] Installing Python packages...", () =>
    run(venvPython(), ["-m", "pip", "install", "-q", "-r", "requirements.txt"], { cwd: serverDir }),
  );
  await step("[3/5] Installing the website packages...", () =>
    run(npmCommand(), ["install", "--no-fund", "--no-audit"], {
      cwd: clientDir,
      shell: process.platform === "win32",
    }),
  );
  await step("[4/5] Creating the database...", () =>
    run(venvPython(), ["-m", "flask", "db", "upgrade"], {
      cwd: serverDir,
      env: { ...process.env, FLASK_APP: "app.py" },
    }),
  );
  await step("[5/5] Adding demo logins...", () =>
    run(venvPython(), ["seed.py", "--if-empty"], { cwd: serverDir }),
  );

  console.log("Done. Start the app with: npm start");
  console.log("Log in at http://127.0.0.1:5173 with alex / password123");
}

main().catch((error) => {
  console.error(error && error.message ? error.message : "Setup failed.");
  process.exit(1);
});
