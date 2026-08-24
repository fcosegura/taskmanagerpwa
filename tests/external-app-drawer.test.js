import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getCreateNotebookErrorDetails,
  isCreateNotebookSuccess,
  isVaultLockedError
} from '../src/externalAppNotebookMessages.js';
import {
  clampDrawerWidth,
  DEFAULT_DRAWER_WIDTH,
  getMaxDrawerWidth,
  MAX_DRAWER_WIDTH_RATIO,
  MIN_DRAWER_WIDTH
} from '../src/externalAppDrawerLayout.js';

const drawerSource = readFileSync(new URL('../src/components/ExternalAppDrawer.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bottomNavSource = readFileSync(new URL('../src/components/BottomNav.jsx', import.meta.url), 'utf8');

test('ExternalAppDrawer interprets MyNotebook create-space result protocol', () => {
  assert.equal(isCreateNotebookSuccess({ ok: true }), true);
  assert.equal(isCreateNotebookSuccess({ success: true }), true);
  assert.equal(isCreateNotebookSuccess({ ok: false }), false);

  assert.deepEqual(getCreateNotebookErrorDetails({
    error: { code: 'vault-locked', message: 'Desbloquea MyNotebook.' }
  }), { code: 'vault-locked', message: 'Desbloquea MyNotebook.' });

  assert.deepEqual(getCreateNotebookErrorDetails({
    error: 'locked',
    message: 'Legacy locked message'
  }), { code: 'locked', message: 'Legacy locked message' });

  assert.equal(isVaultLockedError('vault-locked'), true);
  assert.equal(isVaultLockedError('locked'), true);
  assert.equal(isVaultLockedError('create-failed'), false);
});

test('ExternalAppDrawer embeds MyNotebook in an iframe', () => {
  assert.match(drawerSource, /MY_NOTEBOOK_URL = 'https:\/\/mynotebook\.fcovidalsegura\.workers\.dev\/'/);
  assert.match(drawerSource, /<iframe[\s\S]*src=\{MY_NOTEBOOK_URL\}/);
  assert.match(drawerSource, /title="MyNotebook"/);
});

test('ExternalAppDrawer can request notebook creation through a trusted postMessage channel', () => {
  assert.match(drawerSource, /MY_NOTEBOOK_ORIGIN = new URL\(MY_NOTEBOOK_URL\)\.origin/);
  assert.match(drawerSource, /CREATE_NOTEBOOK_MESSAGE_TYPE = 'taskmanager:create-notebook'/);
  assert.match(drawerSource, /CREATE_NOTEBOOK_RESULT_MESSAGE_TYPE = 'mynotebook:create-notebook:result'/);
  assert.match(drawerSource, /const iframeRef = useRef\(null\)/);
  assert.match(drawerSource, /targetWindow\.postMessage\(\{[\s\S]*type: CREATE_NOTEBOOK_MESSAGE_TYPE[\s\S]*payload: \{ title \}[\s\S]*\}, MY_NOTEBOOK_ORIGIN\)/);
  assert.match(drawerSource, /event\.origin !== MY_NOTEBOOK_ORIGIN/);
  assert.match(drawerSource, /from '\.\.\/externalAppNotebookMessages\.js'/);
  assert.doesNotMatch(drawerSource, /postMessage\([\s\S]*, ['"]\*['"]\)/);
});

test('ExternalAppDrawer supports click-outside and Escape close interactions', () => {
  assert.match(drawerSource, /event\.target === event\.currentTarget/);
  assert.match(drawerSource, /event\.key === 'Escape'/);
  assert.match(drawerSource, /onClose\(\)/);
});

test('ExternalAppDrawer exposes horizontal resizing with min and viewport-based max bounds', () => {
  assert.match(drawerSource, /pointermove/);
  assert.match(drawerSource, /window\.innerWidth - moveEvent\.clientX/);
  assert.match(drawerSource, /from '\.\.\/externalAppDrawerLayout\.js'/);
  assert.match(drawerSource, /aria-valuemax=\{maxDrawerWidth\}/);
  assert.doesNotMatch(drawerSource, /const MAX_DRAWER_WIDTH = 1280/);

  assert.equal(MIN_DRAWER_WIDTH, 320);
  assert.equal(DEFAULT_DRAWER_WIDTH, 1280);
  assert.equal(MAX_DRAWER_WIDTH_RATIO, 0.96);
  assert.equal(getMaxDrawerWidth(1920), 1843);
  assert.equal(getMaxDrawerWidth(2560), 2457);
  assert.equal(clampDrawerWidth(3000, 2560), 2457);
  assert.equal(clampDrawerWidth(900, 2560), 900);
});

test('App and BottomNav expose a Notebook action without changing the current view', () => {
  assert.match(appSource, /const \[externalAppOpen, setExternalAppOpen\] = useState\(false\)/);
  assert.match(appSource, /const openExternalApp = useCallback/);
  assert.match(appSource, /<ExternalAppDrawer isOpen=\{externalAppOpen\} onClose=\{closeExternalApp\} \/>/);
  assert.match(bottomNavSource, /\{ id: 'notebook', label: 'Notebook', external: true \}/);
  assert.match(bottomNavSource, /tab\.external \? onOpenExternalApp\?\.\(\) : setView\(tab\.id\)/);
});
