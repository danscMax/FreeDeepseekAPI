#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const AUTH_PATH = process.env.DEEPSEEK_AUTH_PATH || path.join(ROOT, 'deepseek-auth.json');
const PROFILE_DIR = process.env.DEEPSEEK_CHROME_PROFILE || path.join(ROOT, '.chrome-for-testing-profile-deepseek');
const WATERMARK = 't.me/forgetmeai';

const DEFAULT_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\USUARIO\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
];

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}
function divider() { console.log('======================================================'); }
function watermark(prefix = 'ForgetMeAI') { return `${prefix}: ${WATERMARK}`; }
function loadAuth() {
  try { return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8')); }
  catch { return null; }
}
function findChrome() {
  for (const p of DEFAULT_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function status() {
  const auth = loadAuth();
  console.log('\nDeepSeek account:');
  if (!auth) {
    console.log('  ❌ deepseek-auth.json not found');
  } else {
    console.log(`  ✅ auth file: ${AUTH_PATH}`);
    console.log(`  token: ${auth.token ? 'OK (' + String(auth.token).length + ' chars)' : 'MISSING'}`);
    console.log(`  cookies: ${auth.cookie ? 'OK' : 'MISSING'}`);
    console.log(`  Chrome profile: ${fs.existsSync(PROFILE_DIR) ? PROFILE_DIR : 'not found'}`);
  }
}
function runDirectAuth() {
  const script = path.join(__dirname, 'deepseek_chrome_auth.js');
  return spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env }).status === 0;
}
function runImportAuth() {
  const script = path.join(__dirname, 'auth_import.js');
  return spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env }).status === 0;
}
function removeLocalAuth() {
  if (fs.existsSync(AUTH_PATH)) fs.rmSync(AUTH_PATH, { force: true });
  console.log('Removed deepseek-auth.json. Chrome profile kept to avoid unnecessary logout.');
}
function printHelp() {
  divider();
  console.log('FreeDeepseekAPI — DeepSeek Web login management');
  console.log(watermark());
  divider();
  console.log('Options:');
  console.log('  --login     Open Chrome and refresh auth');
  console.log('  --import    Import deepseek-auth.json / browser cookies');
  console.log('  --status    Show auth status');
  console.log('  --remove    Delete local deepseek-auth.json');
  console.log('  --help      Show this help');
  console.log('No options launches the interactive menu.');
  divider();
}
async function runChromeAuth() {
  console.log('\nLaunching Chrome for authorization...\n');
  const chromePath = process.env.CHROME_PATH || findChrome();

  if (!chromePath) {
    console.log('❌ Chrome not found. Set CHROME_PATH environment variable.');
    return;
  }

  const userDataDir = path.join(ROOT, '.chrome-profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const chromeArgs = [
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-port=9222',
    'https://chat.deepseek.com/',
  ];

  console.log(` Chrome: ${chromePath}`);
  console.log(` Profile: ${userDataDir}`);
  console.log('\n Log in to DeepSeek (if not already).');
  console.log(' Send any message in the chat (e.g., "ok").');
  console.log(' Then return here and press Enter.\n');

  const chrome = spawn(chromePath, chromeArgs, {
    stdio: 'ignore',
    detached: true,
  });
  chrome.unref();

  await prompt('Press Enter after you have logged in and sent a message...');

  console.log('\n Extracting session via CDP...');
  try {
    const { extractAuth } = await import('./cdp-extract.js');
    const auth = await extractAuth('http://localhost:9222');
    if (auth) {
      fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
      console.log('✅ Session saved to', AUTH_PATH);
    } else {
      console.log('❌ Failed to extract session. Please try again.');
    }
  } catch (e) {
    console.log('❌ Error extracting session:', e.message);
    console.log('\n Alternative: export cookies and use option 2 to import.');
  }
}
async function menu() {
  while (true) {
    divider();
    console.log(watermark());
    status();
    divider();
    console.log('Menu:');
    console.log('1 - Authorize / update DeepSeek login');
    console.log('2 - Import auth file / cookies');
    console.log('3 - Show status');
    console.log('4 - Delete local auth file');
    console.log('5 - Exit');
    const choice = (await prompt('Your choice (Enter = 5): ')) || '5';
    if (choice === '1') await runChromeAuth();
    else if (choice === '2') runImportAuth();
    else if (choice === '3') { status(); await prompt('\nPress Enter to return to the menu...'); }
    else if (choice === '4') removeLocalAuth();
    else if (choice === '5') break;
  }
}
(async () => {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) return printHelp();
  if (args.has('--login') || args.has('--add') || args.has('--relogin')) return void runChromeAuth();
  if (args.has('--import')) return void runImportAuth();
  if (args.has('--status') || args.has('--list')) return status();
  if (args.has('--remove')) return removeLocalAuth();
  await menu();
})();
