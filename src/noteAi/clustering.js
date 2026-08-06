/**
 * Deterministic clustering + board layout for Phase 2.
 * Pure functions — no Worker/AI bindings — so they run client-side (offline) or in the pipeline.
 */

/**
 * Union-Find connected components from undirected similarity edges.
 * @param {string[]} noteIds
 * @param {Array<{ a: string, b: string, score?: number }>} edges
 * @returns {string[][]} clusters sorted largest-first; singletons included
 */
export function buildSimilarityClusters(noteIds, edges) {
  const ids = [...new Set((noteIds || []).filter(Boolean))];
  const parent = new Map();
  const rank = new Map();

  const find = (x) => {
    let p = parent.get(x);
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };

  const unite = (a, b) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra) || 0;
    const rankB = rank.get(rb) || 0;
    if (rankA < rankB) {
      const tmp = ra;
      ra = rb;
      rb = tmp;
    }
    parent.set(rb, ra);
    if (rankA === rankB) rank.set(ra, rankA + 1);
  };

  for (const id of ids) {
    parent.set(id, id);
    rank.set(id, 0);
  }

  const idSet = new Set(ids);
  for (const edge of edges || []) {
    const a = edge?.a;
    const b = edge?.b;
    if (!a || !b || a === b) continue;
    if (!idSet.has(a) || !idSet.has(b)) continue;
    unite(a, b);
  }

  const groups = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }

  const clusters = [...groups.values()].map((members) => [...members].sort());
  clusters.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return (a[0] || '').localeCompare(b[0] || '');
  });
  return clusters;
}

/**
 * Edges from note AI relatedIds (bidirectional). Offline-friendly.
 * @param {Record<string, { relatedIds?: string[] }>} metaById
 * @param {string[]} [noteIds]
 */
export function edgesFromRelatedMeta(metaById, noteIds) {
  const ids = noteIds || Object.keys(metaById || {});
  const idSet = new Set(ids);
  const seen = new Set();
  const edges = [];
  for (const id of ids) {
    const related = metaById?.[id]?.relatedIds || [];
    for (const rid of related) {
      if (!idSet.has(rid)) continue;
      const key = id < rid ? `${id}|${rid}` : `${rid}|${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: id, b: rid, score: 0.5 });
    }
  }
  return edges;
}

/**
 * Keep only edges at/above a cosine (or proxy) threshold.
 */
export function filterEdgesByScore(edges, minScore) {
  const min = Number(minScore);
  if (!Number.isFinite(min)) return [...(edges || [])];
  return (edges || []).filter((e) => (e?.score ?? 0) >= min);
}

/**
 * Duplicate groups: connected components using only high-similarity edges.
 * Groups of size < 2 are dropped.
 */
export function findDuplicateGroups(noteIds, edges, minScore) {
  const filtered = filterEdgesByScore(edges, minScore);
  return buildSimilarityClusters(noteIds, filtered).filter((g) => g.length >= 2);
}

/**
 * Compact grid layout for clusters on the board canvas.
 * @param {string[][]} clusters
 * @param {{ noteWidth?: number, boardWidth?: number, noteHeight?: number, gapX?: number, gapY?: number, clusterGapX?: number, clusterGapY?: number, padding?: number, maxPerRow?: number }} [options]
 * @returns {Record<string, { x: number, y: number }>}
 */
export function layoutClusters(clusters, options = {}) {
  const noteWidth = Math.max(120, Number(options.noteWidth) || 200);
  const boardWidth = Math.max(noteWidth + 32, Number(options.boardWidth) || 800);
  const noteHeight = Math.max(120, Number(options.noteHeight) || 200);
  const gapX = Number.isFinite(options.gapX) ? options.gapX : 16;
  const gapY = Number.isFinite(options.gapY) ? options.gapY : 16;
  const clusterGapX = Number.isFinite(options.clusterGapX) ? options.clusterGapX : 36;
  const clusterGapY = Number.isFinite(options.clusterGapY) ? options.clusterGapY : 40;
  const padding = Number.isFinite(options.padding) ? options.padding : 20;
  const maxPerRow = Math.max(1, Number(options.maxPerRow) || 3);

  const positions = {};
  let cursorX = padding;
  let cursorY = padding;
  let rowMaxHeight = 0;
  let usableWidth = boardWidth - padding * 2;

  for (const cluster of clusters || []) {
    const members = Array.isArray(cluster) ? cluster : [];
    if (!members.length) continue;

    const cols = Math.min(maxPerRow, members.length);
    const rows = Math.ceil(members.length / cols);
    const clusterW = cols * noteWidth + (cols - 1) * gapX;
    const clusterH = rows * noteHeight + (rows - 1) * gapY;

    if (cursorX > padding && cursorX + clusterW > usableWidth + padding) {
      cursorX = padding;
      cursorY += rowMaxHeight + clusterGapY;
      rowMaxHeight = 0;
    }

    members.forEach((id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions[id] = {
        x: Math.round(cursorX + col * (noteWidth + gapX)),
        y: Math.round(cursorY + row * (noteHeight + gapY)),
      };
    });

    cursorX += clusterW + clusterGapX;
    rowMaxHeight = Math.max(rowMaxHeight, clusterH);
  }

  return positions;
}

/**
 * Full organize pipeline from related meta (client / offline fallback).
 */
export function organizeNotesFromMeta(noteIds, metaById, layoutOptions) {
  const edges = edgesFromRelatedMeta(metaById, noteIds);
  const clusters = buildSimilarityClusters(noteIds, edges);
  const positions = layoutClusters(clusters, layoutOptions);
  return { clusters, positions, source: 'related_meta' };
}
