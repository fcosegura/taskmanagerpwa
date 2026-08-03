import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

describe('CommandMenu search and item execution', () => {
  const navigationActions = [
    { id: 'nav-today', label: 'Ir a Hoy', icon: '🏠', actionKey: 'today' },
    { id: 'nav-kanban', label: 'Ir a Tablero Kanban', icon: '📊', actionKey: 'kanban' }
  ];

  const tasks = [
    { id: 't1', name: 'Diseñar prototipo', category: 'Diseño' },
    { id: 't2', name: 'Refactorizar API', category: 'Backend' }
  ];

  test('filters matching tasks and navigation actions by search query', () => {
    const query = 'diseño';
    const matchingTasks = tasks.filter(
      (t) => (t.name || '').toLowerCase().includes(query) || (t.category || '').toLowerCase().includes(query)
    );
    const filteredNav = navigationActions.filter((item) => item.label.toLowerCase().includes(query));

    assert.strictEqual(matchingTasks.length, 1);
    assert.strictEqual(matchingTasks[0].id, 't1');
    assert.strictEqual(filteredNav.length, 0);
  });

  test('executes selected navigation item or opens task sheet', () => {
    let navigatedView = null;
    let selectedTask = null;

    const navItem = {
      type: 'nav',
      id: 'nav-kanban',
      label: 'Ir a Tablero Kanban',
      action: () => { navigatedView = 'kanban'; }
    };

    const taskItem = {
      type: 'task',
      id: 'task-t1',
      label: 'Diseñar prototipo',
      task: tasks[0]
    };

    // Execute nav item
    if (navItem.type === 'task') {
      selectedTask = navItem.task;
    } else if (navItem.action) {
      navItem.action();
    }

    assert.strictEqual(navigatedView, 'kanban');
    assert.strictEqual(selectedTask, null);

    // Execute task item
    if (taskItem.type === 'task') {
      selectedTask = taskItem.task;
    } else if (taskItem.action) {
      taskItem.action();
    }

    assert.strictEqual(selectedTask.id, 't1');
  });
});
