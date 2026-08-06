/**
 * Deterministic SVG-friendly graph layout for notes + related edges.
 * Pure functions — offline-safe (no AI / network).
 */

import { buildSimilarityClusters, edgesFromRelatedMeta } from './clustering.js';

/**
 * Place nodes in a circle within a bounding box.
 * @param {string[]} ids
 * @param {{ cx: number, cy: number, radius: number }} circle
 * @returns {Record<string, { x: number, y: number }>}
 */
export function layoutNodesInCircle(ids, circle) {
  const list = (ids || []).filter(Boolean);
  const cx = Number(circle?.cx) || 0;
  const cy = Number(circle?.cy) || 0;
  const radius = Math.max(0, Number(circle?.radius) || 0);
  const positions = {};
  if (!list.length) return positions;
  if (list.length === 1) {
    positions[list[0]] = { x: cx, y: cy };
    return positions;
  }
  list.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / list.length - Math.PI / 2;
    positions[id] = {
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
    };
  });
  return positions;
}

/**
 * Cluster-aware radial layout: each connected component sits in its own cell.
 * @param {string[]} noteIds
 * @param {Array<{ a: string, b: string, score?: number }>} edges
 * @param {{ width?: number, height?: number, padding?: number }} [options]
 * @returns {{ positions: Record<string, { x: number, y: number }>, clusters: string[][] }}
 */
export function layoutNoteGraph(noteIds, edges, options = {}) {
  const ids = [...new Set((noteIds || []).filter(Boolean))];
  const width = Math.max(320, Number(options.width) || 900);
  const height = Math.max(240, Number(options.height) || 560);
  const padding = Number.isFinite(options.padding) ? options.padding : 48;

  const clusters = buildSimilarityClusters(ids, edges);
  const n = Math.max(1, clusters.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = (width - padding * 2) / cols;
  const cellH = (height - padding * 2) / rows;

  const positions = {};
  clusters.forEach((cluster, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = padding + cellW * (col + 0.5);
    const cy = padding + cellH * (row + 0.5);
    const maxR = Math.min(cellW, cellH) * 0.38;
    const radius = cluster.length <= 1 ? 0 : Math.max(28, Math.min(maxR, 18 + cluster.length * 14));
    Object.assign(positions, layoutNodesInCircle(cluster, { cx, cy, radius }));
  });

  return { positions, clusters };
}

/**
 * Build graph model from notes + AI related meta (offline).
 * @param {Array<{ id: string, title?: string, text?: string }>} notes
 * @param {Record<string, { relatedIds?: string[], classification?: string|null, tags?: string[], summary?: string }>} metaById
 * @param {{ width?: number, height?: number }} [layoutOptions]
 */
export function buildNoteGraphModel(notes, metaById, layoutOptions) {
  const list = Array.isArray(notes) ? notes.filter((n) => n?.id) : [];
  const noteIds = list.map((n) => n.id);
  const edges = edgesFromRelatedMeta(metaById || {}, noteIds);
  const { positions, clusters } = layoutNoteGraph(noteIds, edges, layoutOptions);
  const nodes = list.map((n) => {
    const meta = metaById?.[n.id] || {};
    const title = (n.title || '').trim() || (n.text || '').trim().slice(0, 40) || 'Sin título';
    return {
      id: n.id,
      title,
      text: n.text || '',
      x: positions[n.id]?.x ?? 0,
      y: positions[n.id]?.y ?? 0,
      classification: meta.classification || null,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      summary: typeof meta.summary === 'string' ? meta.summary : '',
    };
  });
  return { nodes, edges, clusters, positions };
}
