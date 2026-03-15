#!/usr/bin/env node

/**
 * Manifest CLI — entry point for @manifestdocs/app.
 *
 * Commands:
 *   manifest start [--port N] [--daemon]   Start the server
 *   manifest stop                          Stop the background service
 *   manifest status                        Show running state
 *   manifest setup claude|cursor           Configure MCP integration
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, '..', 'build');
const DEFAULT_PORT = 17010;
const SERVICE_NAME = 'com.manifestdocs.server';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'start':
    await cmdStart(args.slice(1));
    break;
  case 'stop':
    await cmdStop();
    break;
  case 'status':
    await cmdStatus();
    break;
  case 'setup':
    await cmdSetup(args[1]);
    break;
  case 'version':
  case '--version':
  case '-v':
    printVersion();
    break;
  default:
    printUsage();
    break;
}

function printVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
  );
  console.log(`manifest v${pkg.version}`);
}

function printUsage() {
  console.log(`Usage: manifest <command>

Commands:
  start [--port N] [--daemon]   Start the Manifest server (default: :${DEFAULT_PORT})
  stop                          Stop the background service
  status                        Show running state, port, version
  setup claude                  Configure MCP for Claude Code
  setup cursor                  Configure MCP for Cursor
  version                       Print version

Environment:
  PORT                          Server port (default: ${DEFAULT_PORT})
  MANIFEST_API_KEY              Optional API key for protected endpoints`);
}

// --- start ---

async function cmdStart(flags) {
  const port = parsePort(flags);
  const daemon = flags.includes('--daemon');

  if (!fs.existsSync(path.join(BUILD_DIR, 'index.js'))) {
    console.error(
      'Error: Production build not found. Run `pnpm build` in manifest-web first.'
    );
    process.exit(1);
  }

  if (daemon) {
    await installService(port);
    return;
  }

  // Foreground mode — run the SvelteKit node adapter directly
  const env = { ...process.env, PORT: String(port) };
  const child = spawn('node', [path.join(BUILD_DIR, 'index.js')], {
    env,
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 0));

  // Forward signals for clean shutdown
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig));
  }
}

function parsePort(flags) {
  const idx = flags.indexOf('--port');
  if (idx !== -1 && flags[idx + 1]) {
    const p = Number(flags[idx + 1]);
    if (p > 0 && p < 65536) return p;
    console.error(`Invalid port: ${flags[idx + 1]}`);
    process.exit(1);
  }
  return Number(process.env.PORT) || DEFAULT_PORT;
}

// --- stop ---

async function cmdStop() {
  const platform = os.platform();

  if (platform === 'darwin') {
    const plist = launchdPlistPath();
    if (fs.existsSync(plist)) {
      try {
        execSync(`launchctl unload "${plist}"`, { stdio: 'inherit' });
        console.log('Service stopped.');
      } catch {
        console.error('Failed to stop service via launchctl.');
      }
      return;
    }
  }

  if (platform === 'linux') {
    try {
      execSync(`systemctl --user stop ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log('Service stopped.');
      return;
    } catch {
      // fall through to PID file
    }
  }

  // Fallback: PID file
  const pidFile = pidFilePath();
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log(`Stopped process ${pid}.`);
    } catch {
      fs.unlinkSync(pidFile);
      console.log('Process not running. Cleaned up PID file.');
    }
    return;
  }

  console.log('No running service found.');
}

// --- status ---

async function cmdStatus() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
  );

  const port = Number(process.env.PORT) || DEFAULT_PORT;
  let running = false;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/health`);
    running = res.ok;
  } catch {
    // not running
  }

  console.log(`Manifest v${pkg.version}`);
  console.log(`Port:    ${port}`);
  console.log(`Status:  ${running ? 'running' : 'stopped'}`);

  // Check service installation
  const platform = os.platform();
  if (platform === 'darwin' && fs.existsSync(launchdPlistPath())) {
    console.log('Service: launchd (installed)');
  } else if (platform === 'linux') {
    try {
      execSync(`systemctl --user is-enabled ${SERVICE_NAME}`, {
        stdio: 'pipe',
      });
      console.log('Service: systemd (installed)');
    } catch {
      // no systemd service
    }
  }
}

// --- setup ---

async function cmdSetup(target) {
  if (target === 'claude') {
    await setupClaude();
  } else if (target === 'cursor') {
    await setupCursor();
  } else {
    console.log('Usage: manifest setup <claude|cursor>');
    process.exit(1);
  }
}

async function setupClaude() {
  const mcpBin = resolveMcpBin();
  const configPath = path.join(os.homedir(), '.claude.json');
  const port = Number(process.env.PORT) || DEFAULT_PORT;

  const config = readJsonSafe(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.manifest = {
    command: mcpBin,
    env: { MANIFEST_URL: `http://localhost:${port}` },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`Wrote MCP config to ${configPath}`);
  console.log(`  command: ${mcpBin}`);
  console.log(`  MANIFEST_URL: http://localhost:${port}`);
  console.log('\nRestart Claude Code to pick up the new configuration.');
}

async function setupCursor() {
  const mcpBin = resolveMcpBin();
  const configDir = path.join(os.homedir(), '.cursor');
  const configPath = path.join(configDir, 'mcp.json');
  const port = Number(process.env.PORT) || DEFAULT_PORT;

  fs.mkdirSync(configDir, { recursive: true });

  const config = readJsonSafe(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.manifest = {
    command: mcpBin,
    env: { MANIFEST_URL: `http://localhost:${port}` },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`Wrote MCP config to ${configPath}`);
  console.log(`  command: ${mcpBin}`);
  console.log(`  MANIFEST_URL: http://localhost:${port}`);
  console.log('\nRestart Cursor to pick up the new configuration.');
}

function resolveMcpBin() {
  // Check if manifest-mcp is available on PATH
  try {
    const resolved = execSync('which manifest-mcp', { encoding: 'utf-8' }).trim();
    if (resolved) return resolved;
  } catch {
    // not on PATH
  }

  // Check global npm bin
  try {
    const npmBin = execSync('npm bin -g', { encoding: 'utf-8' }).trim();
    const candidate = path.join(npmBin, 'manifest-mcp');
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    // npm not available
  }

  // Fallback: assume it will be on PATH
  return 'manifest-mcp';
}

// --- service management ---

function launchdPlistPath() {
  return path.join(
    os.homedir(),
    'Library',
    'LaunchAgents',
    `${SERVICE_NAME}.plist`
  );
}

function pidFilePath() {
  const dir = path.join(os.homedir(), '.manifest');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'manifest.pid');
}

async function installService(port) {
  const platform = os.platform();
  const manifestBin = process.argv[1];

  if (platform === 'darwin') {
    await installLaunchd(manifestBin, port);
  } else if (platform === 'linux') {
    await installSystemd(manifestBin, port);
  } else {
    await installPidDaemon(port);
  }
}

async function installLaunchd(manifestBin, port) {
  const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  fs.mkdirSync(plistDir, { recursive: true });
  const plistPath = path.join(plistDir, `${SERVICE_NAME}.plist`);

  const logDir = path.join(os.homedir(), '.manifest', 'logs');
  fs.mkdirSync(logDir, { recursive: true });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${manifestBin}</string>
    <string>start</string>
    <string>--port</string>
    <string>${port}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${port}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logDir}/manifest.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/manifest.log</string>
</dict>
</plist>`;

  // Unload existing if present
  if (fs.existsSync(plistPath)) {
    try {
      execSync(`launchctl unload "${plistPath}"`, { stdio: 'pipe' });
    } catch {
      // ignore
    }
  }

  fs.writeFileSync(plistPath, plist);
  execSync(`launchctl load "${plistPath}"`, { stdio: 'inherit' });
  console.log(`Service installed and started on port ${port}.`);
  console.log(`Logs: ${logDir}/manifest.log`);
}

async function installSystemd(manifestBin, port) {
  const unitDir = path.join(
    os.homedir(),
    '.config',
    'systemd',
    'user'
  );
  fs.mkdirSync(unitDir, { recursive: true });
  const unitPath = path.join(unitDir, `${SERVICE_NAME}.service`);

  const unit = `[Unit]
Description=Manifest Server
After=network.target

[Service]
Type=simple
ExecStart=${process.execPath} ${manifestBin} start --port ${port}
Environment=PORT=${port}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target`;

  fs.writeFileSync(unitPath, unit);
  execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
  execSync(`systemctl --user enable --now ${SERVICE_NAME}`, {
    stdio: 'inherit',
  });
  console.log(`Service installed and started on port ${port}.`);
  console.log(`Check logs: journalctl --user -u ${SERVICE_NAME}`);
}

async function installPidDaemon(port) {
  const env = { ...process.env, PORT: String(port) };
  const child = spawn('node', [path.join(BUILD_DIR, 'index.js')], {
    env,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  const pidFile = pidFilePath();
  fs.writeFileSync(pidFile, String(child.pid));
  console.log(`Server started in background (PID: ${child.pid}) on port ${port}.`);
  console.log(`PID file: ${pidFile}`);
}

// --- helpers ---

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}
