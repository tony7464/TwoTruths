const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const serverDir = path.join(root, "server");
const clientDir = path.join(root, "client");

function venvPython() {
  return process.platform === "win32"
    ? path.join(serverDir, ".venv", "Scripts", "python.exe")
    : path.join(serverDir, ".venv", "bin", "python");
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

// cmd.exe (and sh -c) split on spaces, so a path like C:\Users\First Last\...
// has to be quoted before spawn joins the command. Array args stay raw otherwise.
function quoteForShell(value) {
  const text = String(value);
  if (process.platform === "win32") {
    if (text.length === 0) return '""';
    if (!/[\s"&|<>^%]/.test(text)) return text;
    const escaped = text.replace(/"/g, '""').replace(/(\\+)$/g, "$1$1");
    return `"${escaped}"`;
  }
  if (text.length === 0) return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const useShell = Boolean(options.shell);
    const command = useShell ? quoteForShell(cmd) : cmd;
    const commandArgs = useShell ? args.map((arg) => quoteForShell(arg)) : args;
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: useShell,
      windowsHide: true,
    });
    let errorText = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      errorText += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error(`Could not run ${cmd}.`));
        return;
      }
      reject(new Error(error.message));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = errorText.trim() || `${cmd} ${args.join(" ")} exited with code ${code}.`;
      reject(new Error(detail));
    });
  });
}

function capture(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(out.trim());
        return;
      }
      reject(new Error(err.trim() || out.trim() || `${cmd} exited with code ${code}.`));
    });
  });
}

module.exports = {
  root,
  serverDir,
  clientDir,
  venvPython,
  npmCommand,
  run,
  capture,
};
