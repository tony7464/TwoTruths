const fs = require("fs");
const path = require("path");

const { serverDir, clientDir, venvPython, npmCommand, run } = require("./common");

async function runCode(cmd, args, options) {
  try {
    await run(cmd, args, options);
    return 0;
  } catch {
    return 1;
  }
}

async function main() {
  if (!fs.existsSync(venvPython()) || !fs.existsSync(path.join(clientDir, "node_modules"))) {
    console.error('Run "npm run setup" first.');
    process.exit(1);
  }

  console.log("Running server tests...");
  const pytest = await runCode(venvPython(), ["-m", "pytest"], { cwd: serverDir });
  console.log("Running client tests...");
  const vitest = await runCode(npmCommand(), ["test"], {
    cwd: clientDir,
    shell: process.platform === "win32",
  });
  process.exit(pytest === 0 && vitest === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : "Tests failed.");
  process.exit(1);
});
