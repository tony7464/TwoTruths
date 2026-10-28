// Real-browser regression for Two Truths.
//
// Playwright is optional. When it is not installed this file prints SKIP and
// exits 0. Install with `npm i --no-save playwright` inside e2e/, or set
// NODE_PATH to a folder that already has it. Chrome is launched headless
// (PLAYWRIGHT_CHANNEL, default "chrome").
//
// The project database is not used. Flask and seed.py both read DATABASE_URI
// from the environment (server/config.py database_uri(), which seed.py picks
// up by importing the app). This script points that variable at a temporary
// SQLite file, migrates it, and seeds it. Vite is started from e2e/vite.config.mjs
// so /api is proxied at E2E_API_PORT (default 5565) instead of the app's 5555.
// The site is E2E_WEB_PORT (default 5183). A developer's npm start is not touched.
//
// Most checks share one browser context and one logged-in page. A check gets
// its own context only when it would change storage, motion, or the clock for
// the others. The inbox poll installs Playwright's clock before load and
// fast-forwards 20 seconds, so the interval fires without a wall-clock wait.
//
// Allowed error-level console messages are only Chrome's
// "Failed to load resource: the server responded with a status of <code>"
// for these responses, which the checks below cause on purpose:
//   401  POST /api/login   wrong password
//   409  POST /api/signup  "Alex" while alex already exists
//   429  POST /api/login   the sixth bad password
// Any console message containing "synchronously unmount" fails the run.

const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const serverDir = path.join(root, "server");
const clientDir = path.join(root, "client");
const outputDir = path.join(__dirname, "output");
const python = path.join(serverDir, ".venv", "bin", "python");

const API_PORT = portFrom("E2E_API_PORT", 5565);
const WEB_PORT = portFrom("E2E_WEB_PORT", 5183);
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || "chrome";
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const CHECK_TIMEOUT_MS = 90000;
const E2E_MARKER = "TWO_TRUTHS_E2E";

const WRONG_LOGIN = "Username or password is incorrect.";
const NAME_TAKEN = "That username is taken.";
const RATE_LIMIT = "Too many login attempts. Try again in a minute.";
const CONTEXT_LOST = "3D view stopped because the browser lost the graphics context. Reload the page to try 3D again.";
const UNMOUNT_SNIPPET = "synchronously unmount";

const LAPTOPS = [
  [1366, 768],
  [1024, 768],
  [1536, 864],
  [1280, 720],
  [1280, 800],
  [1400, 1000],
  [1024, 700],
];
const PROFILE_SCROLL = new Set(["1280x800", "1400x1000"]);
const APP_FACES = ["Statements", "Profile", "Players", "Inbox"];

function portFrom(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    console.error(`${name} must be a TCP port. Got ${raw}.`);
    process.exit(1);
  }
  return value;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") return null;
    throw error;
  }
}

const playwright = loadPlaywright();
if (!playwright) {
  console.log(
    "SKIP: Playwright is not installed. Install it without saving it "
    + "(`npm i --no-save playwright` inside e2e/) or set NODE_PATH to a "
    + "node_modules that contains playwright, then run npm run e2e again. Exit 0.",
  );
  process.exit(0);
}

const { chromium } = playwright;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}\n${output}`));
    });
  });
}

const serverLog = [];
function remember(label, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (!line) continue;
    serverLog.push(`[${label}] ${line}`);
    if (serverLog.length > 200) serverLog.shift();
  }
}

function startProcess(cmd, args, options, label) {
  const child = spawn(cmd, args, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => remember(label, chunk));
  child.stderr.on("data", (chunk) => remember(label, chunk));
  return child;
}

function killTree(child) {
  if (!child || child.pid == null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch { /* already gone */ }
  }
}

function procText(pid, name) {
  try {
    return fs.readFileSync(`/proc/${pid}/${name}`).toString("utf8");
  } catch {
    return "";
  }
}

function isOwnE2eProcess(pid) {
  const env = procText(pid, "environ");
  const cmd = procText(pid, "cmdline");
  if (env.includes(`${E2E_MARKER}=1`)) return true;
  if (env.includes("twotruths-e2e-")) return true;
  if (cmd.includes(`${path.sep}e2e${path.sep}vite.config.mjs`)) return true;
  if (cmd.includes("/e2e/vite.config.mjs")) return true;
  return false;
}

function signalPid(pid, signal) {
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // The pid is not a process-group leader.
  }
  try {
    process.kill(pid, signal);
  } catch {
    // Already gone.
  }
}

function pidsFromProc(port) {
  const suffix = `:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      if (parts[3] !== "0A") continue;
      if (!parts[1].toUpperCase().endsWith(suffix)) continue;
      inodes.add(parts[9]);
    }
  }
  if (inodes.size === 0) return [];
  const pids = new Set();
  let entries = [];
  try {
    entries = fs.readdirSync("/proc");
  } catch {
    return [];
  }
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    let fds = [];
    try {
      fds = fs.readdirSync(`/proc/${name}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      let link = "";
      try {
        link = fs.readlinkSync(`/proc/${name}/fd/${fd}`);
      } catch {
        continue;
      }
      const match = /^socket:\[(\d+)\]$/.exec(link);
      if (match && inodes.has(match[1])) pids.add(Number(name));
    }
  }
  return [...pids];
}

function listenersOn(port) {
  try {
    const out = execFileSync("ss", ["-H", "-ltn", `sport = :${port}`], { encoding: "utf8" });
    const listening = out.split("\n").map((line) => line.trim()).filter(Boolean);
    const pids = new Set();
    try {
      const named = execFileSync("ss", ["-H", "-ltnp", `sport = :${port}`], { encoding: "utf8" });
      for (const match of named.matchAll(/pid=(\d+)/g)) pids.add(Number(match[1]));
    } catch {
      // ss can list the socket and still hide the process name.
    }
    if (listening.length > 0 && pids.size === 0) {
      for (const pid of pidsFromProc(port)) pids.add(pid);
    }
    return { listening: listening.length > 0, pids: [...pids] };
  } catch {
    const pids = pidsFromProc(port);
    return { listening: pids.length > 0, pids };
  }
}

async function releaseLeftoverPorts() {
  const ports = [API_PORT, WEB_PORT];
  for (const port of ports) {
    const info = listenersOn(port);
    if (!info.listening) continue;
    if (info.pids.length === 0) {
      console.error(`port ${port} is busy and the listener could not be identified; not killing it`);
      return false;
    }
    console.error(`port ${port} is busy (pid ${info.pids.join(", ")})`);
    const foreign = info.pids.filter((pid) => !isOwnE2eProcess(pid));
    if (foreign.length > 0) {
      console.error(
        `port ${port} is in use by pid ${foreign.join(", ")}, which is not an e2e child `
        + `(no ${E2E_MARKER} marker, twotruths-e2e temp database, or e2e vite config); not killing it`,
      );
      return false;
    }
    for (const pid of info.pids) {
      console.error(`stopping leftover e2e process ${pid} on port ${port}`);
      signalPid(pid, "SIGTERM");
    }
  }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const busy = ports.filter((port) => listenersOn(port).listening);
    if (busy.length === 0) return true;
    await sleep(200);
  }
  for (const port of ports) {
    const info = listenersOn(port);
    if (!info.listening) continue;
    const own = info.pids.filter((pid) => isOwnE2eProcess(pid));
    const foreign = info.pids.filter((pid) => !isOwnE2eProcess(pid));
    if (foreign.length > 0 || (info.listening && own.length === 0)) {
      console.error(`port ${port} is still busy after cleanup (pid ${info.pids.join(", ") || "unknown"}); not killing it`);
      return false;
    }
    for (const pid of own) {
      console.error(`killing leftover e2e process ${pid} on port ${port}`);
      signalPid(pid, "SIGKILL");
    }
  }
  await sleep(300);
  for (const port of ports) {
    const info = listenersOn(port);
    if (!info.listening) continue;
    console.error(`port ${port} is still busy (pid ${info.pids.join(", ") || "unknown"})`);
    return false;
  }
  return true;
}

function killChildrenSync() {
  if (state.browser) {
    try {
      const proc = state.browser.process();
      if (proc && proc.pid) process.kill(proc.pid, "SIGKILL");
    } catch {
      // Chrome is already gone.
    }
  }
  for (const child of state.children) {
    killTree(child);
    if (child && child.pid != null) signalPid(child.pid, "SIGKILL");
  }
  if (state.tmpDir && !state.tmpRemoved) {
    state.tmpRemoved = true;
    try {
      fs.rmSync(state.tmpDir, { recursive: true, force: true });
    } catch {
      // Already removed.
    }
  }
}

function onFatal(kind, error) {
  if (state.fatal) process.exit(1);
  state.fatal = true;
  const raw = error && (error.stack || error.message) ? (error.stack || error.message) : String(error);
  const brief = String(raw).split("\n")[0];
  const name = currentCheck ? `${currentCheck} ` : "";
  fs.writeSync(1, `FAIL ${name}${kind} ${brief}\n`);
  fs.writeSync(2, `${raw}\n`);
  if (serverLog.length) fs.writeSync(2, `${serverLog.slice(-40).join("\n")}\n`);
  killChildrenSync();
  printTotal();
  process.exit(1);
}

function onSignal(name, code) {
  if (state.fatal) process.exit(code);
  state.fatal = true;
  fs.writeSync(1, `FAIL ${name}\n`);
  killChildrenSync();
  printTotal();
  process.exit(code);
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url} (${last})`);
}

async function api(pathname, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(`http://127.0.0.1:${API_PORT}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  const parts = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  return {
    status: response.status,
    data,
    cookie: parts.map((item) => item.split(";")[0]).join("; "),
  };
}

const results = [];
const state = {
  tmpDir: "",
  children: [],
  browser: null,
  own: [],
  session: { page: null, context: null },
  abort: false,
  tmpRemoved: false,
  fatal: false,
};
let currentCheck = "";

function mark(name, ok, note, elapsedMs) {
  const timing = ` (${(elapsedMs / 1000).toFixed(1)}s)`;
  const line = `${ok ? "PASS" : "FAIL"} ${name}${note ? ` ${note}` : ""}${timing}`;
  results.push({ name, ok, line });
  fs.writeSync(1, `${line}\n`);
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
}

const issues = [];

async function openPage(browser, tag, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1400, height: 1000 },
    reducedMotion: options.reducedMotion || "no-preference",
  });
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    const text = error && error.message ? error.message : String(error);
    issues.push({
      tag,
      kind: text.includes(UNMOUNT_SNIPPET) ? "unmount" : "pageerror",
      text,
    });
  });
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes(UNMOUNT_SNIPPET)) {
      issues.push({ tag, kind: "unmount", text });
      return;
    }
    if (message.type() === "error") {
      issues.push({ tag, kind: "console", text });
    }
  });
  return { context, page };
}

async function shot(page, name) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const pending = page.screenshot({ path: path.join(outputDir, `${name}.png`) }).catch(() => {});
    await Promise.race([pending, sleep(5000)]);
  } catch {
    // A screenshot failure should not hide the check result.
  }
}

function visibleForm(page, submitName) {
  return page.locator("form").filter({
    has: page.getByRole("button", { name: submitName, exact: true }),
  }).filter({ visible: true });
}

function faceButton(page, label) {
  return page.getByRole("group", { name: "Cube faces" })
    .getByRole("button", { name: `${label} face`, exact: true });
}

// The shake hides the form until the timeline ends. Click Skip whenever it is
// showing, and stop when `ready` is true. The deadline is a wall clock, so a
// stalled animation frame cannot wait forever.
async function untilReady(page, ready, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  const skip = page.getByRole("button", { name: "Skip animation" });
  while (Date.now() < deadline) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ timeout: 1000 }).catch(() => {});
    }
    if (await ready().catch(() => false)) return;
    await sleep(40);
  }
  if (await ready().catch(() => false)) return;
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

// A turn or a failed-login shake sets `locked`, and every face becomes inert
// until that timeline finishes. The signup form also keeps what was typed
// ("Alex" after the 409). Playwright will resolve that input as soon as it
// has a box, then block inside fill or click while the panel is inert, still
// moving, or covered. Wait until the open face is still and the control is
// the hit target before typing or submitting.
function authSurfaceReady(submitName) {
  const skip = [...document.querySelectorAll("button")].some((button) => {
    return button.textContent.trim() === "Skip animation";
  });
  if (skip) return false;

  function boxOf(el) {
    const rect = el.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height];
  }

  function hittable(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const target = document.elementFromPoint(x, y);
    return Boolean(target && (target === el || el.contains(target)));
  }

  function faceOpen(face) {
    const style = getComputedStyle(face);
    return style.pointerEvents !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity) >= 0.99
      && !face.querySelector("[inert]");
  }

  const form = [...document.querySelectorAll("form")].find((node) => {
    return [...node.querySelectorAll("button")].some((button) => {
      return button.type === "submit" && button.textContent.trim() === submitName;
    });
  });
  if (!form || form.closest("[inert]")) return false;
  const face = form.closest("[data-testid='cube-face']");
  if (face) {
    const open = [...document.querySelectorAll("[data-testid='cube-face']")].filter(faceOpen);
    if (open.length !== 1 || open[0] !== face) return false;
  }
  const input = form.querySelector('input[autocomplete="username"]');
  const button = [...form.querySelectorAll("button")].find((item) => {
    return item.type === "submit" && item.textContent.trim() === submitName;
  });
  if (!input || !button || input.disabled || button.disabled) return false;
  if (!hittable(input) || !hittable(button)) return false;
  const box = boxOf(input);
  const prev = window.__e2eAuthBox;
  window.__e2eAuthBox = box;
  if (!prev || prev.some((value, index) => Math.abs(value - box[index]) > 1)) return false;
  return true;
}

async function readAuthReady(page, submitName) {
  return page.evaluate(authSurfaceReady, submitName);
}

async function settleAuth(page, submitName, timeoutMs = 15000) {
  await page.evaluate(() => { window.__e2eAuthBox = null; }).catch(() => {});
  await untilReady(page, () => readAuthReady(page, submitName), timeoutMs, `${submitName} form`);
}

async function appFaceReady(page) {
  return page.evaluate(() => {
    const faces = [...document.querySelectorAll("[data-testid='cube-face']")];
    const open = faces.filter((face) => {
      const style = getComputedStyle(face);
      return style.pointerEvents !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) >= 0.99
        && !face.querySelector("[inert]");
    });
    if (open.length !== 1) return false;
    const rect = open[0].getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const box = [rect.left, rect.top, rect.width, rect.height];
    const prev = window.__e2eFaceBox;
    window.__e2eFaceBox = box;
    if (!prev || prev.some((value, index) => Math.abs(value - box[index]) > 1)) return false;
    const skip = [...document.querySelectorAll("button")].some((button) => {
      return button.textContent.trim() === "Skip animation";
    });
    return !skip;
  });
}

async function pickPlayer(page, name, statement) {
  await showFace(page, "Players");
  const player = page.getByRole("button", { name: new RegExp(`^${name}\\b`) });
  const statementButton = page.getByRole("button", { name: statement, exact: true });
  await untilReady(page, async () => {
    if (await statementButton.isVisible().catch(() => false)) return true;
    const hit = await player.evaluate((el) => {
      if (!el.isConnected || el.closest("[inert]")) return false;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.pointerEvents === "none" || Number(style.opacity) < 0.99) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(target && (target === el || el.contains(target)));
    }, 0, { timeout: 1000 }).catch(() => false);
    if (hit) await player.click({ timeout: 1000 }).catch(() => {});
    return false;
  }, 15000, `${name} statements`);
}

async function showFace(page, label) {
  const button = faceButton(page, label);
  await page.evaluate(() => { window.__e2eFaceBox = null; window.__e2eAuthBox = null; }).catch(() => {});
  await untilReady(page, async () => {
    const pressed = await button.getAttribute("aria-pressed").catch(() => null);
    if (pressed !== "true") {
      const disabled = await button.isDisabled().catch(() => true);
      if (!disabled) await button.click({ timeout: 1000 }).catch(() => {});
      return false;
    }
    if (await button.isDisabled().catch(() => true)) return false;
    if (label === "Log in" || label === "Sign up") return readAuthReady(page, label);
    return appFaceReady(page);
  }, 15000, `${label} face`);
}

async function gotoLogin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  // The first SwiftShader compile can finish after the load event.
  await settleAuth(page, "Log in", 45000);
}

async function freshLogin(page) {
  const logoutButton = page.getByRole("button", { name: "Log out", exact: true });
  if (await logoutButton.isVisible().catch(() => false)) await logout(page);
  await gotoLogin(page);
}

async function showAlert(page, text) {
  const alert = page.getByRole("alert").filter({ visible: true, hasText: text });
  await untilReady(page, () => alert.isVisible(), 20000, `alert ${text}`);
}

async function postAndWait(page, urlPart, action) {
  const pending = page.waitForResponse((response) => {
    return response.url().includes(urlPart) && response.request().method() === "POST";
  }).then(
    (response) => ({ ok: true, response }),
    (error) => ({ ok: false, error }),
  );
  const acted = Promise.resolve().then(action).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error }),
  );
  const [posted, done] = await Promise.all([pending, acted]);
  if (!posted.ok || !done.ok) {
    const parts = [];
    if (!done.ok) {
      parts.push(done.error && done.error.message ? done.error.message : String(done.error));
    }
    if (!posted.ok) {
      const message = posted.error && posted.error.message ? posted.error.message : String(posted.error);
      parts.push(`no POST ${urlPart} response (${message})`);
    }
    throw new Error(`${currentCheck}: ${parts.join(" | ")}`);
  }
  return posted.response;
}

async function submitLogin(page, username, password) {
  await settleAuth(page, "Log in");
  const form = visibleForm(page, "Log in");
  await form.getByLabel("Username").fill(username);
  await form.getByLabel("Password").fill(password);
  return postAndWait(page, "/api/login", () => {
    return form.getByRole("button", { name: "Log in", exact: true }).click();
  });
}

async function login(page, username, password = "password123", options = {}) {
  await submitLogin(page, username, password);
  if (options.enterApp) await waitForApp(page);
}

async function logout(page) {
  await page.getByRole("button", { name: "Log out", exact: true }).click({ timeout: 10000 });
  await assertLoginScreen(page);
}

async function assertLoginScreen(page) {
  await settleAuth(page, "Log in");
  const heading = page.getByRole("heading", { name: "Log in", exact: true }).filter({ visible: true });
  assertOk(/\/login$/.test(page.url()), `url ${page.url()}`);
  assertOk(await heading.isVisible().catch(() => false), "login heading missing");
}

async function assertSignupScreen(page) {
  await settleAuth(page, "Sign up");
  const heading = page.getByRole("heading", { name: "Sign up", exact: true }).filter({ visible: true });
  assertOk(/\/signup$/.test(page.url()), `url ${page.url()}`);
  assertOk(await heading.isVisible().catch(() => false), "sign up heading missing");
}

async function openSignup(page) {
  await showFace(page, "Sign up");
}

async function signup(page, username, password = "password123", bio) {
  await openSignup(page);
  await settleAuth(page, "Sign up");
  const form = visibleForm(page, "Sign up");
  await form.getByLabel("Username").fill(username);
  await form.getByLabel("Password").fill(password);
  if (bio !== undefined) await form.getByLabel(/Bio/).fill(bio);
  return postAndWait(page, "/api/signup", () => {
    return form.getByRole("button", { name: "Sign up", exact: true }).click();
  });
}

async function waitForApp(page) {
  const button = page.getByRole("button", { name: "Statements face" });
  await untilReady(page, async () => {
    return await button.isVisible().catch(() => false) && !await button.isDisabled().catch(() => true);
  }, 20000, "app");
}

async function waitForStage(page) {
  // The cube frame is an even square from the 78vh formula. The HTML faces
  // catch up on a later animation frame, so wait until the open face sits
  // inside that square. Interval polling, not animation frames, so a stalled
  // frame cannot wait forever.
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    const frame = canvas && canvas.parentElement && canvas.parentElement.parentElement;
    const stage = frame && frame.parentElement;
    if (!frame || !stage) return false;
    const available = stage.clientWidth;
    if (!(available > 0)) return false;
    const raw = Math.min(window.innerHeight * 0.78, 720, available);
    const size = Math.floor(raw / 2) * 2;
    const rect = frame.getBoundingClientRect();
    if (!(size >= 2 && Math.abs(rect.width - size) <= 1 && Math.abs(rect.height - size) <= 1)) {
      return false;
    }
    frame.scrollIntoView({ block: "nearest", inline: "nearest" });
    const host = canvas.parentElement;
    const shells = [...host.children].filter((el) => el !== canvas && el.style.width);
    if (!shells.length) return false;
    const shellsFit = shells.every((shell) => {
      const width = Number.parseFloat(shell.style.width);
      const height = Number.parseFloat(shell.style.height);
      return Math.abs(width - rect.width) <= 1 && Math.abs(height - rect.height) <= 1;
    });
    if (!shellsFit) return false;
    const open = [...document.querySelectorAll("[data-testid='cube-face']")].find((face) => {
      const style = getComputedStyle(face);
      return style.pointerEvents !== "none" && Number(style.opacity) > 0.5;
    });
    if (!open) return false;
    const faceRect = open.getBoundingClientRect();
    const slop = 2;
    return faceRect.width > 0
      && faceRect.left >= rect.left - slop
      && faceRect.top >= rect.top - slop
      && faceRect.right <= rect.right + slop
      && faceRect.bottom <= rect.bottom + slop;
  }, null, { timeout: 8000, polling: 100 });
}

async function setLaptop(page, width, height) {
  await page.setViewportSize({ width, height });
  await waitForStage(page);
}

function viewportName(width, height) {
  return `${width}x${height}`;
}

// Runs in the page. Reports geometry problems for one face.
function inspectFace(spec) {
  const problems = [];

  function describe(el) {
    if (!el) return "nothing";
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "")
      .trim().replace(/\s+/g, " ").slice(0, 50);
    return `${el.tagName}${text ? ` "${text}"` : ""}`;
  }

  function fmt(rect) {
    return `[${rect.left.toFixed(1)},${rect.top.toFixed(1)} ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}]`;
  }

  function stageBox() {
    const canvas = document.querySelector("canvas");
    const frame = canvas && canvas.parentElement && canvas.parentElement.parentElement;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function faceEl() {
    const faces = [...document.querySelectorAll("[data-testid='cube-face']")];
    const open = faces.filter((face) => {
      const style = getComputedStyle(face);
      return style.pointerEvents !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) > 0.5;
    });
    return open.length === 1 ? open[0] : null;
  }

  function inside(rect, stage) {
    const slop = 1;
    return rect.width > 0
      && rect.height > 0
      && rect.left >= stage.left - slop
      && rect.top >= stage.top - slop
      && rect.right <= stage.right + slop
      && rect.bottom <= stage.bottom + slop;
  }

  function add(message) {
    problems.push(`${spec.viewport} ${message}`);
  }

  const stage = stageBox();
  const face = faceEl();
  if (!stage) {
    add(`${spec.face} stage missing`);
    return problems;
  }
  if (!face) {
    add(`${spec.face} active face missing stage ${fmt(stage)}`);
    return problems;
  }

  if (spec.mode === "auth") {
    const form = [...face.querySelectorAll("form")].find((node) => {
      return [...node.querySelectorAll("button")].some((button) => button.textContent.trim() === spec.submit);
    });
    if (!form) {
      add(`${spec.face} form missing stage ${fmt(stage)}`);
      return problems;
    }
    const fields = [
      ["Username", form.querySelector('input[autocomplete="username"]')],
      ["Password", form.querySelector('input[type="password"]')],
    ];
    for (const [name, input] of fields) {
      if (!input) {
        add(`${spec.face} ${name} input missing`);
        continue;
      }
      const rect = input.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      const points = [
        ["left", rect.left + 2],
        ["center", rect.left + rect.width / 2],
        ["right", rect.right - 2],
      ];
      for (const [where, x] of points) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit.tagName !== "INPUT" || hit !== input) {
          add(`${spec.face} ${name} ${where} (${x.toFixed(1)},${y.toFixed(1)}) hit ${describe(hit)} input ${fmt(rect)} stage ${fmt(stage)}`);
        }
      }
      const label = input.closest("label");
      if (!label || !label.textContent.includes(name)) {
        add(`${spec.face} ${name} label missing`);
      } else if (!inside(label.getBoundingClientRect(), stage)) {
        add(`${spec.face} label ${name} outside stage label ${fmt(label.getBoundingClientRect())} stage ${fmt(stage)}`);
      }
    }
    return problems;
  }

  const controls = [...face.querySelectorAll("button, input, textarea")].filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
  const targets = controls.length > 0
    ? controls
    : [...face.querySelectorAll("p")].filter((el) => el.innerText.trim());
  if (targets.length === 0) {
    add(`${spec.face} has no controls stage ${fmt(stage)}`);
  }
  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    const name = (el.getAttribute("aria-label")
      || el.innerText
      || (el.getAttribute("maxlength") === "160" ? "bio" : "")
      || el.type
      || el.tagName).trim().replace(/\s+/g, " ").slice(0, 60);
    if (!inside(rect, stage)) {
      add(`${spec.face} ${name} outside stage control ${fmt(rect)} stage ${fmt(stage)}`);
    }
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== el && !el.contains(hit))) {
      add(`${spec.face} ${name} center (${x.toFixed(1)},${y.toFixed(1)}) hit ${describe(hit)} control ${fmt(rect)} stage ${fmt(stage)}`);
    }
  }

  if (spec.scroll) {
    function reportScroll(node, name) {
      if (node.clientHeight === 0 || node.scrollHeight > node.clientHeight) {
        add(`${spec.face} ${name} scrollHeight ${node.scrollHeight} > clientHeight ${node.clientHeight}`);
      }
    }
    reportScroll(face, "face");
    let statement = 0;
    for (const node of face.querySelectorAll("textarea")) {
      const name = node.getAttribute("maxlength") === "160" ? "bio" : `statement ${statement += 1}`;
      reportScroll(node, name);
    }
    for (const node of face.querySelectorAll("*")) {
      const style = getComputedStyle(node);
      const scrolls = style.overflowY === "auto" || style.overflowY === "scroll"
        || style.overflowX === "auto" || style.overflowX === "scroll";
      if (scrolls && node.scrollHeight > node.clientHeight) {
        add(`${spec.face} scroller ${describe(node)} scrollHeight ${node.scrollHeight} > clientHeight ${node.clientHeight}`);
      }
    }
  }

  return problems;
}

function pageFrom(getPage) {
  try {
    return typeof getPage === "function" ? getPage() : getPage;
  } catch {
    return null;
  }
}

async function check(name, getPage, fn) {
  if (state.abort) return;
  currentCheck = name;
  const started = Date.now();
  const work = fn().then(
    (note) => ({ ok: true, note: note || "" }),
    (error) => ({ ok: false, error }),
  );
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, timeout: true }), CHECK_TIMEOUT_MS);
  });
  const outcome = await Promise.race([work, timeout]);
  clearTimeout(timer);
  if (outcome.timeout) {
    state.abort = true;
    const page = pageFrom(getPage);
    if (page) await page.close().catch(() => {});
    await Promise.race([work, sleep(3000)]);
    mark(name, false, `hard timeout after ${CHECK_TIMEOUT_MS / 1000}s`, Date.now() - started);
    return;
  }
  if (!outcome.ok) {
    const page = pageFrom(getPage);
    if (page) await shot(page, name.replace(/[^a-z0-9]+/gi, "-").slice(0, 40));
    const raw = outcome.error && outcome.error.message ? outcome.error.message : String(outcome.error);
    const message = raw.split("\n").map((part) => part.trim()).filter(Boolean).slice(0, 4).join(" | ");
    mark(name, false, message, Date.now() - started);
    return;
  }
  mark(name, true, outcome.note, Date.now() - started);
}

let runStarted = 0;

function printTotal() {
  if (!runStarted) return;
  fs.writeSync(1, `TOTAL ${((Date.now() - runStarted) / 1000).toFixed(1)}s\n`);
  runStarted = 0;
}

async function main() {
  runStarted = Date.now();
  if (!fs.existsSync(python)) {
    console.error('Run "npm run setup" first. The server virtualenv is missing.');
    process.exit(1);
  }
  if (!chromium || typeof chromium.launch !== "function") {
    console.error("Playwright loaded but chromium.launch is missing.");
    process.exit(1);
  }
  if (!await releaseLeftoverPorts()) process.exit(1);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "twotruths-e2e-"));
  state.tmpDir = tmpDir;
  const dbPath = path.join(tmpDir, "e2e.db");
  const databaseUri = `sqlite:///${dbPath.split(path.sep).join("/")}`;
  if (databaseUri.includes("instance/app.db")) {
    throw new Error("Refusing to use the project database.");
  }
  const childEnv = {
    ...process.env,
    [E2E_MARKER]: "1",
    TWO_TRUTHS_E2E_TMP: tmpDir,
    DATABASE_URI: databaseUri,
    FLASK_APP: "app.py",
    FLASK_DEBUG: "1",
    PYTHONUNBUFFERED: "1",
  };
  console.log(`e2e database ${databaseUri}`);
  console.log(`e2e api ${API_PORT} web ${WEB_PORT} channel ${CHANNEL}`);

  const children = state.children;
  let browser;
  const session = state.session;
  const own = state.own;

  try {
    const upgraded = await run(python, ["-m", "flask", "db", "upgrade"], {
      cwd: serverDir,
      env: childEnv,
    });
    if (upgraded) console.log(upgraded.split("\n").slice(-1)[0]);
    console.log(await run(python, ["seed.py"], { cwd: serverDir, env: childEnv }));

    const apiServer = startProcess(python, [
      "-m", "flask", "run",
      "--host", "127.0.0.1",
      "--port", String(API_PORT),
      "--no-reload",
    ], {
      cwd: serverDir,
      env: {
        ...childEnv,
        FLASK_RUN_HOST: "127.0.0.1",
        FLASK_RUN_PORT: String(API_PORT),
      },
    }, "api");
    children.push(apiServer);

    const viteBin = path.join(clientDir, "node_modules", "vite", "bin", "vite.js");
    const web = startProcess(process.execPath, [
      viteBin,
      "--config", path.join(__dirname, "vite.config.mjs"),
      "--host", "127.0.0.1",
      "--port", String(WEB_PORT),
    ], {
      cwd: clientDir,
      env: {
        ...process.env,
        [E2E_MARKER]: "1",
        TWO_TRUTHS_E2E_TMP: tmpDir,
        E2E_API_PORT: String(API_PORT),
        E2E_WEB_PORT: String(WEB_PORT),
      },
    }, "web");
    children.push(web);

    await waitForHttp(`http://127.0.0.1:${API_PORT}/api/health`, 60000);
    await waitForHttp(BASE, 60000);

    browser = await chromium.launch({
      channel: CHANNEL,
      headless: true,
      args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
    });
    state.browser = browser;

    await check("login and four faces", () => session.page, async () => {
      const opened = await openPage(browser, "session");
      session.page = opened.page;
      session.context = opened.context;
      const page = opened.page;
      await gotoLogin(page);
      const bad = await submitLogin(page, "alex", "wrongpass");
      assertOk(bad.status() === 401, `wrong password status ${bad.status()}`);
      await showAlert(page, WRONG_LOGIN);
      await assertLoginScreen(page);

      await login(page, "alex", "password123", { enterApp: true });
      const canvas = await page.locator("canvas").count();
      const probes = [
        ["Statements", /I have worked a 4 a\.m\.|I can make pasta|I have read Dune|I wake up at 5:30|Pick someone from the Players face/],
        ["Players", /jordan|sam|riley/],
        ["Inbox", /Guess someone correctly to unlock messaging|No messages yet/],
        ["Profile", /Your two truths and a lie/],
      ];
      for (const [label, probe] of probes) {
        await showFace(page, label);
        await page.getByText(probe).filter({ visible: true }).first().waitFor({ state: "visible" });
      }
      assertOk(canvas > 0, `canvas=${canvas}`);
      return `canvas=${canvas}`;
    });

    await check("login and every face render fully at laptop sizes", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await logout(page);
      const problems = [];
      try {
      await showFace(page, "Log in");
      for (const [width, height] of LAPTOPS) {
        const viewport = viewportName(width, height);
        await setLaptop(page, width, height);
        problems.push(...await page.evaluate(inspectFace, {
          mode: "auth",
          viewport,
          face: "Log in",
          submit: "Log in",
        }));
      }
      await showFace(page, "Sign up");
      for (const [width, height] of LAPTOPS) {
        const viewport = viewportName(width, height);
        await setLaptop(page, width, height);
        problems.push(...await page.evaluate(inspectFace, {
          mode: "auth",
          viewport,
          face: "Sign up",
          submit: "Sign up",
        }));
      }
      await showFace(page, "Log in");
      await login(page, "alex", "password123", { enterApp: true });
      for (const label of APP_FACES) {
        await showFace(page, label);
        if (label === "Statements") {
          await page.getByRole("button", { name: "Lock in guess" }).waitFor({ state: "visible" });
        } else if (label === "Profile") {
          await page.getByRole("heading", { name: "Your two truths and a lie" }).waitFor({ state: "visible" });
        } else if (label === "Players") {
          await page.getByRole("button", { name: /^jordan\b/ }).waitFor({ state: "visible" });
        } else if (label === "Inbox") {
          await page.getByText("No messages yet").filter({ visible: true }).first().waitFor({ state: "visible" });
        } else {
          throw new Error(`unknown face ${label}`);
        }
        for (const [width, height] of LAPTOPS) {
          const viewport = viewportName(width, height);
          await setLaptop(page, width, height);
          problems.push(...await page.evaluate(inspectFace, {
            mode: "app",
            viewport,
            face: label,
            scroll: label === "Profile" && PROFILE_SCROLL.has(viewport),
          }));
        }
      }
      if (problems.length) throw new Error(problems.join(" || "));
      return LAPTOPS.map(([width, height]) => viewportName(width, height)).join(", ");
      } finally {
        await page.setViewportSize({ width: 1400, height: 1000 }).catch(() => {});
        await waitForStage(page).catch(() => {});
      }
    });

    await check("wrong and correct guess, message without reload", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await page.evaluate(() => { window.__e2eMarker = "guess"; });
      await pickPlayer(page, "sam", "I have read Dune three times.");
      await page.getByRole("button", { name: "I have read Dune three times.", exact: true }).click({ force: true });
      await page.getByRole("button", { name: "Lock in guess" }).click({ force: true });
      await untilReady(
        page,
        () => page.getByText("wrong", { exact: true }).first().isVisible(),
        15000,
        "wrong guess",
      );
      const wrongNote = await page.getByText("That was your one guess. Messaging stays closed.").count();
      assertOk(wrongNote > 0, "wrong-guess note missing");

      await pickPlayer(page, "jordan", "I have a pet snake named Noodle.");
      await page.getByRole("button", { name: "I have a pet snake named Noodle.", exact: true }).click({ force: true });
      await page.getByRole("button", { name: "Lock in guess" }).click({ force: true });
      await untilReady(
        page,
        () => page.getByText("Correct. Send the first message.").isVisible(),
        15000,
        "correct guess",
      );

      const message = `Hi Jordan ${Date.now()}`;
      await page.getByLabel("Message to jordan").fill(message, { force: true });
      const sentResponse = await postAndWait(page, "/api/messages", () => {
        return page.getByRole("button", { name: "Send", exact: true }).click({ force: true });
      });
      assertOk(sentResponse.status() === 201, `send status ${sentResponse.status()}`);
      await page.getByText("Sent. It is in your inbox.").waitFor({ state: "visible" });
      await page.locator("li").filter({ hasText: message }).waitFor({ state: "visible" });
      assertOk(
        await page.getByText("No messages yet").filter({ visible: true }).count() === 0,
        "empty inbox text still showing",
      );
      assertOk(await page.evaluate(() => window.__e2eMarker) === "guess", "page reloaded");
      return message;
    });

    await check("bio save persists", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await showFace(page, "Profile");
      const bio = `E2E bio ${Date.now()}`;
      const box = page.locator("textarea[maxlength='160']").first();
      await box.fill(bio, { force: true });
      await page.getByRole("button", { name: "Save", exact: true }).click({ force: true });
      await page.getByText("Saved.", { exact: true }).waitFor({ state: "visible" });
      await page.reload({ waitUntil: "load" });
      await waitForApp(page);
      await showFace(page, "Profile");
      const value = await page.locator("textarea[maxlength='160']").first().inputValue();
      assertOk(value === bio, `bio is ${JSON.stringify(value)}`);
      return "saved";
    });

    await check("delete statements confirm and cancel", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await showFace(page, "Profile");
      const remove = page.getByRole("button", { name: "Delete statements and start over" });
      await remove.scrollIntoViewIfNeeded();
      await remove.click({ force: true });
      await page.getByText("Delete all three statements and start over?").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Cancel", exact: true }).click({ force: true });
      await page.getByRole("button", { name: "Delete statements and start over" }).waitFor({ state: "visible" });
      const stillThere = await page.getByText("Delete all three statements and start over?").count();
      const statements = await page.evaluate(async () => {
        const response = await fetch("/api/statements", { credentials: "include" });
        return response.json();
      });
      assertOk(stillThere === 0, "confirm question stayed");
      assertOk(Array.isArray(statements) && statements.length === 3, `statements ${JSON.stringify(statements).slice(0, 120)}`);
      return "cancelled";
    });

    await check("webgl context loss and reload", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      const before = issues.length;
      await page.locator("canvas").first().waitFor({ state: "visible" });
      await page.evaluate(() => { window.__e2eMarker = "context"; });
      const method = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        const ext = gl && gl.getExtension("WEBGL_lose_context");
        if (ext) {
          ext.loseContext();
          return "WEBGL_lose_context";
        }
        canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
        return "dispatch";
      });
      await page.getByText(CONTEXT_LOST).waitFor({ state: "visible" });
      const reload = page.getByRole("button", { name: "Reload page" });
      await reload.waitFor({ state: "visible" });
      await reload.click();
      await page.waitForLoadState("load");
      await page.locator("canvas").first().waitFor({ state: "visible", timeout: 20000 });
      assertOk(await page.evaluate(() => window.__e2eMarker) === undefined, "reload did not replace the page");
      const unmount = issues.slice(before).filter((item) => item.kind === "unmount" || item.text.includes(UNMOUNT_SNIPPET));
      assertOk(unmount.length === 0, unmount.map((item) => item.text).join(" | "));
      return method;
    });

    let flatPage = null;
    try {
      await check("flat view reduced motion, chosen flat, and 600px", () => flatPage, async () => {
        const reduced = await openPage(browser, "flat-motion", { reducedMotion: "reduce" });
        own.push(reduced);
        flatPage = reduced.page;
        await gotoLogin(reduced.page);
        await login(reduced.page, "alex", "password123", { animate: false });
        await reduced.page.getByText("3D view is off because your system has reduced motion enabled")
          .waitFor({ state: "visible" });
        assertOk(await reduced.page.locator("canvas").count() === 0, "reduced motion still had a canvas");
        await reduced.page.getByRole("button", { name: "Show 3D cube anyway" }).click();
        await reduced.page.locator("canvas").first().waitFor({ state: "visible", timeout: 20000 });
        await reduced.context.close();

        const chosen = await openPage(browser, "flat-choice");
        own.push(chosen);
        flatPage = chosen.page;
        await gotoLogin(chosen.page);
        await login(chosen.page, "alex", "password123", { enterApp: true });
        await chosen.page.locator("canvas").first().waitFor({ state: "visible" });
        await chosen.page.getByRole("button", { name: "Use flat view" }).click();
        await chosen.page.getByText("3D view is off because you chose the flat view").waitFor({ state: "visible" });
        assertOk(await chosen.page.locator("canvas").count() === 0, "chosen flat still had a canvas");
        await chosen.page.getByRole("button", { name: "Use 3D cube" }).click();
        await chosen.page.locator("canvas").first().waitFor({ state: "visible", timeout: 20000 });
        const back = await chosen.page.locator("body").innerText();
        assertOk(!/you chose the flat view/.test(back), "flat reason still showing");
        await chosen.context.close();

        const narrow = await openPage(browser, "flat-narrow", { viewport: { width: 600, height: 900 } });
        own.push(narrow);
        flatPage = narrow.page;
        await gotoLogin(narrow.page);
        await login(narrow.page, "alex", "password123", { animate: false });
        await narrow.page.getByText("3D view is off because this screen is narrow or touch")
          .waitFor({ state: "visible" });
        assertOk(await narrow.page.locator("canvas").count() === 0, "narrow viewport still had a canvas");
        await narrow.context.close();
        flatPage = null;
        return "reduced, chosen, 600px";
      });
    } finally {
      flatPage = null;
    }

    await check("case-different signup stays on sign up", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await freshLogin(page);
      await openSignup(page);
      const form = visibleForm(page, "Sign up");
      await form.getByLabel("Username").fill("Alex");
      await form.getByLabel("Password").fill("password123");
      const conflict = await postAndWait(page, "/api/signup", () => {
        return form.getByRole("button", { name: "Sign up", exact: true }).click();
      });
      assertOk(conflict.status() === 409, `signup status ${conflict.status()}`);
      await showAlert(page, NAME_TAKEN);
      await assertSignupScreen(page);
      return NAME_TAKEN;
    });

    await check("account delete of a throwaway user", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await freshLogin(page);
      const created = await signup(page, "zz_test", "password123", "throwaway");
      assertOk(created.status() === 201, `signup status ${created.status()}`);
      await waitForApp(page);
      await showFace(page, "Profile");
      await page.getByRole("button", { name: "Delete my account" }).click({ force: true });
      await page.getByRole("button", { name: "Yes, delete everything" }).waitFor({ state: "visible" });
      await page.getByLabel("Password").last().fill("password123");
      await page.getByRole("button", { name: "Yes, delete everything" }).click({ force: true });
      await page.waitForURL(/\/login$/, { timeout: 15000 });
      await assertLoginScreen(page);

      const again = await submitLogin(page, "zz_test", "password123");
      assertOk(again.status() === 401, `relogin status ${again.status()}`);
      await showAlert(page, WRONG_LOGIN);
      await assertLoginScreen(page);
      return "deleted";
    });

    await check("sixth bad login returns 429", () => session.page, async () => {
      const page = session.page;
      if (!page) throw new Error("shared page was not opened");
      await freshLogin(page);
      const statuses = [];
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const response = await submitLogin(page, "noluck", "wrongpass");
        statuses.push(response.status());
      }
      assertOk(statuses.slice(0, 5).every((status) => status === 401), `first five ${statuses.join(",")}`);
      assertOk(statuses[5] === 429, `sixth ${statuses[5]}`);
      await showAlert(page, RATE_LIMIT);
      await assertLoginScreen(page);
      return statuses.join(",");
    });

    let pollPage = null;
    try {
      await check("inbox shows another user's message within the poll", () => pollPage, async () => {
        console.log(await run(python, ["seed.py", "--guesses"], { cwd: serverDir, env: childEnv }));
        const opened = await openPage(browser, "poll");
        own.push(opened);
        pollPage = opened.page;
        if (typeof opened.page.clock?.install !== "function" || typeof opened.page.clock?.fastForward !== "function") {
          throw new Error("installed Playwright has no page.clock.install/fastForward");
        }
        // Clock is per context. Install before the first load so the inbox
        // interval is fake from the start, then jump 20s once the face is idle.
        await opened.page.clock.install();
        const gets = { inflight: 0 };
        const isMessagesGet = (request) => request.method() === "GET" && request.url().includes("/api/messages");
        opened.page.on("request", (request) => {
          if (isMessagesGet(request)) gets.inflight += 1;
        });
        opened.page.on("requestfinished", (request) => {
          if (isMessagesGet(request)) gets.inflight = Math.max(0, gets.inflight - 1);
        });
        opened.page.on("requestfailed", (request) => {
          if (isMessagesGet(request)) gets.inflight = Math.max(0, gets.inflight - 1);
        });

        await gotoLogin(opened.page);
        await login(opened.page, "alex", "password123", { enterApp: true });
        await opened.page.evaluate(() => { window.__e2eMarker = "poll"; });
        await showFace(opened.page, "Inbox");
        await opened.page.getByText("No messages yet").waitFor({ state: "visible" });
        const quietDeadline = Date.now() + 8000;
        let quiet = 0;
        while (Date.now() < quietDeadline) {
          await sleep(80);
          if (gets.inflight === 0) {
            quiet += 1;
            if (quiet >= 2) break;
          } else {
            quiet = 0;
          }
        }
        assertOk(gets.inflight === 0, "inbox requests did not finish");
        assertOk(
          await opened.page.getByText("No messages yet").filter({ visible: true }).count() > 0,
          "inbox was not empty before the other user wrote",
        );

        const alex = await api("/api/login", {
          method: "POST",
          body: { username: "alex", password: "password123" },
        });
        const statements = await api("/api/statements", { cookie: alex.cookie });
        const lie = Array.isArray(statements.data)
          ? statements.data.find((item) => item.is_lie)
          : null;
        assertOk(lie, `alex statements ${JSON.stringify(statements.data).slice(0, 160)}`);
        const jordan = await api("/api/login", {
          method: "POST",
          body: { username: "jordan", password: "password123" },
        });
        const users = await api("/api/users", { cookie: jordan.cookie });
        const alexUser = Array.isArray(users.data)
          ? users.data.find((item) => item.username === "alex")
          : null;
        assertOk(alexUser, "jordan could not see alex");
        const guess = await api("/api/guesses", {
          method: "POST",
          cookie: jordan.cookie,
          body: { profile_user_id: alexUser.id, statement_id: lie.id },
        });
        assertOk(guess.status === 201, `guess ${guess.status} ${JSON.stringify(guess.data).slice(0, 160)}`);
        const message = `Poll from jordan ${Date.now()}`;
        const sent = await api("/api/messages", {
          method: "POST",
          cookie: jordan.cookie,
          body: { recipient_id: alexUser.id, body: message },
        });
        assertOk(sent.status === 201, `message ${sent.status} ${JSON.stringify(sent.data).slice(0, 160)}`);
        await sleep(150);
        assertOk(
          !(await opened.page.locator("body").innerText()).includes(message),
          "message showed up before the poll",
        );

        await opened.page.clock.fastForward(20000);
        await opened.page.getByText(message).waitFor({ state: "visible", timeout: 10000 });
        assertOk(await opened.page.evaluate(() => window.__e2eMarker) === "poll", "page reloaded");
        await opened.context.close();
        pollPage = null;
        return "clock +20s";
      });
    } finally {
      pollPage = null;
    }

    await check("console errors", () => null, async () => {
      const allowed = /failed to load resource: the server responded with a status of (401|409|429)\b/i;
      const unexpected = issues.filter((item) => {
        if (item.kind === "unmount" || item.text.includes(UNMOUNT_SNIPPET)) return true;
        if (item.kind === "console" && allowed.test(item.text)) return false;
        return true;
      });
      const expected = issues.filter((item) => item.kind === "console" && allowed.test(item.text));
      assertOk(
        unexpected.length === 0,
        unexpected.map((item) => `${item.tag} ${item.kind} ${item.text}`).join(" || "),
      );
      return `allowed ${expected.length} (401, 409, 429 failed-resource lines only); no synchronously unmount`;
    });
  } finally {
    if (!state.fatal) {
      await Promise.race([
        (async () => {
          for (const opened of own) {
            if (opened && opened.context) await opened.context.close().catch(() => {});
          }
          if (session.context) await session.context.close().catch(() => {});
          if (browser) await browser.close().catch(() => {});
        })(),
        sleep(8000),
      ]);
      for (const child of children) killTree(child);
      await sleep(400);
      killChildrenSync();
      printTotal();
    }
  }

  if (results.some((item) => !item.ok)) {
    if (serverLog.length) console.log(serverLog.slice(-30).join("\n"));
    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => onFatal("unhandledRejection", error));
process.on("uncaughtException", (error) => onFatal("uncaughtException", error));
process.on("SIGINT", () => onSignal("SIGINT", 130));
process.on("SIGTERM", () => onSignal("SIGTERM", 143));

main().catch((error) => {
  if (state.fatal) return;
  console.error("FATAL", error && error.stack ? error.stack : error);
  if (serverLog.length) console.error(serverLog.slice(-40).join("\n"));
  killChildrenSync();
  printTotal();
  process.exit(1);
});
