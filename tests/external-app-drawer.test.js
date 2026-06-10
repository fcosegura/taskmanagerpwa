import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawerSource = readFileSync(new URL('../src/components/ExternalAppDrawer.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bottomNavSource = readFileSync(new URL('../src/components/BottomNav.jsx', import.meta.url), 'utf8');

test('ExternalAppDrawer embeds MyNotebook in an iframe', () => {
  assert.match(drawerSource, /MY_NOTEBOOK_URL = 'https:\/\/mynotebook\.fcovidalsegura\.workers\.dev\/'/);
  assert.match(drawerSource, /<iframe[\s\S]*src=\{MY_NOTEBOOK_URL\}/);
  assert.match(drawerSource, /title="MyNotebook"/);
});

test('ExternalAppDrawer supports click-outside and Escape close interactions', () => {
  assert.match(drawerSource, /event\.target === event\.currentTarget/);
  assert.match(drawerSource, /event\.key === 'Escape'/);
  assert.match(drawerSource, /onClose\(\)/);
});

test('ExternalAppDrawer exposes horizontal resizing with min and max bounds', () => {
  assert.match(drawerSource, /const MIN_DRAWER_WIDTH = 320/);
  assert.match(drawerSource, /pointermove/);
  assert.match(drawerSource, /window\.innerWidth - moveEvent\.clientX/);
  assert.match(drawerSource, /Math\.min\(900, Math\.floor\(viewportWidth \* 0\.92\)\)/);
});

test('App and BottomNav expose a Notebook action without changing the current view', () => {
  assert.match(appSource, /const \[externalAppOpen, setExternalAppOpen\] = useState\(false\)/);
  assert.match(appSource, /const openExternalApp = useCallback/);
  assert.match(appSource, /<ExternalAppDrawer isOpen=\{externalAppOpen\} onClose=\{closeExternalApp\} \/>/);
  assert.match(bottomNavSource, /\{ id: 'notebook', label: 'Notebook', external: true \}/);
  assert.match(bottomNavSource, /tab\.external \? onOpenExternalApp\?\.\(\) : setView\(tab\.id\)/);
});
