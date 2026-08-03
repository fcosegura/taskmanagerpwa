import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { getDisplayDescription } from '../src/todayViewHelpers.js';

describe('TodayView task and event classification', () => {
  const todayStr = '2026-07-31';

  test('correctly partitions tasks into todayTasks and overdueTasks by date', () => {
    const focusTasks = [
      { id: '1', name: 'Tarea de hoy 1', date: '2026-07-31', status: 'not_done' },
      { id: '2', name: 'Tarea atrasada 1', date: '2026-07-30', status: 'not_done' },
      { id: '3', name: 'Tarea de hoy 2', date: '2026-07-31', status: 'in_progress' },
      { id: '4', name: 'Tarea completada hoy', date: '2026-07-31', status: 'done', completedAt: '2026-07-31T10:00:00Z' },
      { id: '5', name: 'Tarea futura', date: '2026-08-01', status: 'not_done' }
    ];

    const tByDate = {
      '2026-07-31': [focusTasks[0], focusTasks[2], focusTasks[3]]
    };

    const todayTasks = (tByDate[todayStr] || []).filter((t) => t.status !== 'done');
    const overdueTasks = focusTasks.filter((t) => t.date && t.date < todayStr && t.status !== 'done');
    const completedTodayCount = focusTasks.filter((t) => t.status === 'done' && t.completedAt && t.completedAt.startsWith(todayStr)).length;

    assert.strictEqual(todayTasks.length, 2);
    assert.deepStrictEqual(todayTasks.map((t) => t.id), ['1', '3']);
    assert.strictEqual(overdueTasks.length, 1);
    assert.strictEqual(overdueTasks[0].id, '2');
    assert.strictEqual(completedTodayCount, 1);
  });

  test('sorts today events safely by time badge format', () => {
    const rawEvents = [
      { id: 'e1', title: 'Reunión de equipo', startTime: '10:00', allDay: false },
      { id: 'e2', title: 'Revisión código', startTime: '09:00', allDay: false },
      { id: 'e3', name: 'Evento todo el día', allDay: true }
    ];

    const sortedEvents = [...rawEvents].sort((a, b) => {
      const timeA = a.startTime || a.time || '00:00';
      const timeB = b.startTime || b.time || '00:00';
      return timeA.localeCompare(timeB);
    });

    const renderedBadges = sortedEvents.map((evt) => (
      evt.allDay ? 'Todo el día' : (evt.startTime || evt.time || 'Todo el día')
    ));

    const renderedTitles = sortedEvents.map((evt) => (
      evt.title || evt.name || 'Evento'
    ));

    assert.deepStrictEqual(renderedTitles, ['Evento todo el día', 'Revisión código', 'Reunión de equipo']);
    assert.deepStrictEqual(renderedBadges, ['Todo el día', '09:00', '10:00']);
  });

  describe('getDisplayDescription helper', () => {
    test('filters out technical tokens / encrypted hashes without mutating task', () => {
      const task = {
        id: 't-tech',
        name: '[iOS-Betsson] Logged-in users',
        description: 'v1.6lgnaqHZCbZRczVpXxf0Pg7+I3ktB9j0HvHUUCJzuPyVgc0FGlqjP/iH0AsGQKEYGWdzl8XHkh2I/WI7JpIFAR1A8qHImPORl/1uekxLwfaEj1b6DRuoajgXZmFLcufi6ZxfQbNOK9Crtg=='
      };

      const result = getDisplayDescription(task);
      assert.strictEqual(result, '');
      // Ensure immutability of task object
      assert.strictEqual(task.description.startsWith('v1.'), true);
    });

    test('preserves valid human descriptions from notes or description', () => {
      const taskWithNotes = { id: 't1', notes: 'Revisar métricas del servidor' };
      const taskWithDesc = { id: 't2', description: 'Documentar endpoints de API' };

      assert.strictEqual(getDisplayDescription(taskWithNotes), 'Revisar métricas del servidor');
      assert.strictEqual(getDisplayDescription(taskWithDesc), 'Documentar endpoints de API');
    });

    test('returns empty string when task has no description or notes', () => {
      assert.strictEqual(getDisplayDescription(null), '');
      assert.strictEqual(getDisplayDescription({ id: 't3' }), '');
      assert.strictEqual(getDisplayDescription({ id: 't4', notes: '   ' }), '');
    });
  });
});

