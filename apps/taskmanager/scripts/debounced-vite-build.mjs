import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** Evita SQLITE_BUSY: menos recargas de Wrangler que con `vite build --watch` inmediato. */
const DEBOUNCE_MS = Number(process.env.VITE_WATCH_DEBOUNCE_MS) || 4000;

let timer = null;
let building = false;

function runBuild() {
  if (building) return;
  building = true;
  const p = spawn('npx', ['vite', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  p.on('close', (code) => {
    building = false;
    if (code !== 0) process.stderr.write(`[debounced-build] vite build exit ${code}\n`);
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runBuild, DEBOUNCE_MS);
}

watch(SRC, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  const f = filename.toString();
  if (!/\.(jsx?|tsx?|css)$/i.test(f)) return;
  schedule();
});

console.log(`[debounced-build] watching ${SRC} (debounce ${DEBOUNCE_MS}ms)`);
