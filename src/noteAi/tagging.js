/** Conservative, deterministic themes supported by multiple distinct content words. */
import { noteTokens, normalizeNoteText } from './contentSignals.js';

const THEMES = [
  ['calma', 'calma tranquilidad tranquila tranquilo serenidad sosiego pausas pausa tregua relajacion descanso'],
  ['rutina', 'rutina ritual habito habitos cotidiano cotidiana costumbre costumbres'],
  ['reflexión', 'reflexion reflexionar pensamientos pensamiento lucidez introspeccion contemplar observa mente'],
  ['trabajo', 'proyecto proyectos cliente clientes sprint reunion reuniones equipo trabajo entrega'],
  ['aprendizaje', 'aprender aprendizaje estudiar estudio investigacion investigar documentacion curso cursos'],
  ['salud', 'salud medico medica medicacion tratamiento sintomas consulta diagnostico'],
  ['finanzas', 'presupuesto ahorro gastos ingresos inversion factura facturas deuda finanzas'],
  ['viajes', 'viaje viajes viajar vuelo vuelos hotel itinerario equipaje destino'],
  ['cocina', 'receta recetas cocinar cocina ingredientes horno sarten'],
  ['ejercicio', 'ejercicio deporte entrenamiento entrenar gimnasio correr carrera fuerza'],
  ['tecnología', 'codigo software servidor api aplicacion despliegue programacion repositorio'],
];
const GENERIC = new Set('empezar empieza comenzar comienza primeras primeros primera primero ultimo ultima pequenos pequeno pequena grandes grande resto basta ver mirar hace falta veces realmente verdaderamente suficiente breve antes despues'.split(' '));

export function wholeNoteTagCandidates(title, text) {
  const body = String(text || '').trim();
  const content = body || String(title || '');
  const sections = content.split(/\n\s*\n|(?<=[.!?])\s+/u).filter(Boolean);
  const counts = new Map();
  const coverage = new Map();
  const sectionWords = sections.map((section) => {
    const words = noteTokens(section, { minLength: 4 }).filter((word) => !GENERIC.has(word) && !/^(?:test|prueba|nota)\d+$/u.test(word));
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    for (const word of new Set(words)) coverage.set(word, (coverage.get(word) || 0) + 1);
    return new Set(words);
  });
  const allWords = new Set(noteTokens(content));
  const themes = THEMES.map(([tag, terms]) => ({
    tag, hits: terms.split(' ').filter((term) => allWords.has(normalizeNoteText(term))).length,
  })).filter((theme) => theme.hits >= 2).sort((a, b) => b.hits - a.hits || a.tag.localeCompare(b.tag));
  // Multiple corroborated themes describe the whole note better than isolated words.
  if (themes.length >= 2) return themes.slice(0, 5).map((theme) => theme.tag);

  const ranked = [...counts.keys()].sort((a, b) =>
    (coverage.get(b) * 2 + Math.log1p(counts.get(b))) - (coverage.get(a) * 2 + Math.log1p(counts.get(a))) || a.localeCompare(b));
  const selected = themes.map((theme) => theme.tag);
  if (themes.length === 1) {
    const supporting = THEMES.find(([tag]) => tag === themes[0].tag)[1].split(' ')
      .find((word) => word !== normalizeNoteText(themes[0].tag) && allWords.has(word));
    if (supporting) selected.push(supporting);
  }
  const represented = new Set();
  // Prefer terms spanning sentences, then diversify across the entire document.
  while (selected.length < 5 && ranked.length) {
    const score = (word) => coverage.get(word) * 2 + Math.log1p(counts.get(word))
      + sectionWords.reduce((sum, words, index) => sum + (words.has(word) && !represented.has(index) ? 1 : 0), 0);
    ranked.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    const word = ranked.shift();
    if (!selected.includes(word)) selected.push(word);
    sectionWords.forEach((words, index) => { if (words.has(word)) represented.add(index); });
  }
  return selected;
}

/** Keep short notes whole; for long notes sample evenly instead of taking only the opening. */
export function sampleNoteForAnalysis(text, budget = 8000) {
  const value = String(text || '');
  if (value.length <= budget) return value;
  if (budget < 64) return value.slice(0, Math.max(0, budget));
  const separator = '\n[…]\n';
  const count = 8;
  const size = Math.floor((budget - separator.length * (count - 1)) / count);
  const chunks = Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * (value.length - size) / (count - 1));
    return value.slice(start, start + size);
  });
  return chunks.join(separator);
}
