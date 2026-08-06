import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildNoteGraphModel } from '../noteAi/graphLayout.js';
import { chatNotesRag } from '../storage.js';
import './GraphView.css';

const VIEWBOX_W = 900;
const VIEWBOX_H = 560;

function noteLabel(node) {
  const t = (node?.title || '').trim();
  if (t) return t.length > 28 ? `${t.slice(0, 27)}…` : t;
  return 'Sin título';
}

export default function GraphView({
  notes = [],
  noteAiMetaById = {},
  noteAiPrefs,
  isOnline = true,
  activeProfileId,
  onSelectNote,
}) {
  const showGraph = noteAiPrefs?.graph !== false;
  const showChat = noteAiPrefs?.ragChat !== false;

  const [selectedId, setSelectedId] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  const model = useMemo(
    () => buildNoteGraphModel(notes, noteAiMetaById, { width: VIEWBOX_W, height: VIEWBOX_H }),
    [notes, noteAiMetaById]
  );

  const selectedNode = useMemo(
    () => model.nodes.find((n) => n.id === selectedId) || null,
    [model.nodes, selectedId]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [messages, chatBusy]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    if (onSelectNote) onSelectNote(id);
  }, [onSelectNote]);

  const onPointerDownBackground = (e) => {
    if (e.target !== svgRef.current && e.target?.dataset?.role !== 'graph-bg') return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setPan({
      x: d.panX + (e.clientX - d.startX),
      y: d.panY + (e.clientY - d.startY),
    });
  };

  const onPointerUp = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(2.4, Math.max(0.45, s * delta)));
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatBusy) return;
    if (!isOnline) {
      setChatError('El chat de notas requiere conexión.');
      return;
    }
    if (!activeProfileId) {
      setChatError('No hay workspace activo.');
      return;
    }
    setChatError('');
    setChatInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setChatBusy(true);
    try {
      const data = await chatNotesRag(q, activeProfileId, noteAiPrefs);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data?.answer || 'No encuentro eso en tus notas.',
          source: data?.source,
          citedNoteIds: Array.isArray(data?.citedNoteIds) ? data.citedNoteIds : [],
        },
      ]);
    } catch (err) {
      setChatError(err?.message || 'No se pudo consultar el chat.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'No pude responder ahora. Inténtalo de nuevo.', source: 'error' },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  if (!showGraph) {
    return (
      <div className="graph-view graph-view--disabled material-base" role="status">
        <p>El grafo de notas está desactivado en Ajustes.</p>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <div className="graph-view-toolbar material-base">
        <div className="graph-view-toolbar-meta">
          <span>{model.nodes.length} notas</span>
          <span aria-hidden="true">·</span>
          <span>{model.edges.length} relaciones</span>
        </div>
        <div className="graph-view-toolbar-actions">
          <button type="button" className="graph-tool-btn" onClick={resetView}>
            Centrar
          </button>
          {showChat && (
            <button
              type="button"
              className={`graph-tool-btn ${chatOpen ? 'active' : ''}`}
              onClick={() => setChatOpen((v) => !v)}
              aria-expanded={chatOpen}
              aria-controls="notes-rag-chat-panel"
            >
              Chat notas
            </button>
          )}
        </div>
      </div>

      <div className="graph-view-body">
        <div className="graph-canvas-wrap material-base">
          {model.nodes.length === 0 ? (
            <div className="graph-empty">
              <p>No hay notas en este workspace.</p>
              <p className="graph-empty-hint">Crea notas en el Tablero; las relaciones aparecen cuando la IA las indexa.</p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="graph-svg"
              viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
              role="img"
              aria-label="Grafo de notas relacionadas"
              onPointerDown={onPointerDownBackground}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            >
              <rect
                data-role="graph-bg"
                x="0"
                y="0"
                width={VIEWBOX_W}
                height={VIEWBOX_H}
                fill="transparent"
              />
              <g transform={`translate(${pan.x / scale}, ${pan.y / scale}) scale(${scale})`}>
                {model.edges.map((e) => {
                  const a = model.positions[e.a];
                  const b = model.positions[e.b];
                  if (!a || !b) return null;
                  return (
                    <line
                      key={`${e.a}|${e.b}`}
                      className="graph-edge"
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                    />
                  );
                })}
                {model.nodes.map((node) => {
                  const active = node.id === selectedId;
                  return (
                    <g
                      key={node.id}
                      className={`graph-node ${active ? 'is-selected' : ''}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleSelect(node.id);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          handleSelect(node.id);
                        }
                      }}
                      aria-label={noteLabel(node)}
                    >
                      <circle r={active ? 22 : 18} className="graph-node-circle" />
                      <text className="graph-node-label" y={34} textAnchor="middle">
                        {noteLabel(node)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {selectedNode && (
            <aside className="graph-detail material-base" aria-live="polite">
              <div className="graph-detail-title">{selectedNode.title || 'Sin título'}</div>
              {selectedNode.classification && (
                <div className="graph-detail-chip">{selectedNode.classification}</div>
              )}
              {selectedNode.summary ? (
                <p className="graph-detail-summary">{selectedNode.summary}</p>
              ) : (
                <p className="graph-detail-summary graph-detail-summary--muted">
                  {(selectedNode.text || '').slice(0, 220) || 'Sin contenido'}
                </p>
              )}
              {selectedNode.tags?.length > 0 && (
                <div className="graph-detail-tags">
                  {selectedNode.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="graph-detail-tag">{tag}</span>
                  ))}
                </div>
              )}
              <button type="button" className="graph-tool-btn" onClick={() => setSelectedId(null)}>
                Cerrar
              </button>
            </aside>
          )}
        </div>

        {showChat && chatOpen && (
          <section
            id="notes-rag-chat-panel"
            className="graph-chat material-base"
            aria-label="Chat contextual de notas"
          >
            <header className="graph-chat-header">
              <h2>Chat de notas</h2>
              <p>Responde solo con el contenido de tus notas de este workspace.</p>
            </header>
            <div className="graph-chat-messages" role="log" aria-relevant="additions">
              {messages.length === 0 && (
                <p className="graph-chat-placeholder">
                  Pregunta algo como «¿qué anoté sobre el sprint?»
                </p>
              )}
              {messages.map((m, i) => (
                <div key={`${m.role}-${i}`} className={`graph-chat-msg graph-chat-msg--${m.role}`}>
                  <div className="graph-chat-msg-text">{m.text}</div>
                  {m.role === 'assistant' && Array.isArray(m.citedNoteIds) && m.citedNoteIds.length > 0 && (
                    <div className="graph-chat-cites">
                      {m.citedNoteIds.slice(0, 4).map((id) => {
                        const n = notes.find((x) => x.id === id);
                        const label = (n?.title || '').trim() || id.slice(0, 8);
                        return (
                          <button
                            key={id}
                            type="button"
                            className="graph-cite-btn"
                            onClick={() => handleSelect(id)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {chatBusy && <p className="graph-chat-busy">Buscando en tus notas…</p>}
              <div ref={chatEndRef} />
            </div>
            {chatError && <p className="graph-chat-error" role="alert">{chatError}</p>}
            {!isOnline && (
              <p className="graph-chat-offline" role="status">Sin conexión: el chat no está disponible.</p>
            )}
            <form
              className="graph-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Pregunta sobre tus notas…"
                aria-label="Pregunta sobre tus notas"
                disabled={chatBusy || !isOnline}
                maxLength={600}
              />
              <button type="submit" disabled={chatBusy || !isOnline || !chatInput.trim()}>
                Enviar
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
