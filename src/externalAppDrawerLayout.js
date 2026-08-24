export const MIN_DRAWER_WIDTH = 320;
export const DEFAULT_DRAWER_WIDTH = 1280;
export const MAX_DRAWER_WIDTH_RATIO = 0.96;

export function getMaxDrawerWidth(viewportWidth, fallbackWidth = DEFAULT_DRAWER_WIDTH) {
  const width = typeof viewportWidth === 'number' && viewportWidth > 0
    ? viewportWidth
    : fallbackWidth;
  return Math.max(MIN_DRAWER_WIDTH, Math.floor(width * MAX_DRAWER_WIDTH_RATIO));
}

export function clampDrawerWidth(width, viewportWidth, fallbackWidth = DEFAULT_DRAWER_WIDTH) {
  const maxWidth = getMaxDrawerWidth(viewportWidth, fallbackWidth);
  return Math.min(Math.max(width, MIN_DRAWER_WIDTH), maxWidth);
}
