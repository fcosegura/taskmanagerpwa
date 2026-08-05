import { useState } from 'react';
import { Modal, Button } from './ui/index.jsx';

export default function TaskTrashDropZone({
  draggedTaskId,
  allTasks = [],
  onDeleteTask,
  className = '',
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedId = draggedTaskId || e.dataTransfer?.getData('text/plain');
    if (!droppedId) return;

    const task = allTasks.find((t) => t.id === droppedId);
    if (task) {
      setTaskToDelete(task);
    }
  };

  const confirmDelete = () => {
    if (taskToDelete && onDeleteTask) {
      onDeleteTask(taskToDelete.id);
    }
    setTaskToDelete(null);
  };

  const isDraggingAny = Boolean(draggedTaskId);

  return (
    <>
      <div
        className={`task-trash-drop-zone ${isDraggingAny ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''} ${className}`.trim()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title="Arrastra una tarea aquí para eliminarla"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 999,
          border: isDragOver
            ? '1.5px solid var(--color-danger, #ef4444)'
            : isDraggingAny
              ? '1.5px dashed var(--color-danger, #ef4444)'
              : '0.5px solid var(--color-border-tertiary)',
          background: isDragOver
            ? 'rgba(239, 68, 68, 0.15)'
            : isDraggingAny
              ? 'rgba(239, 68, 68, 0.06)'
              : 'var(--color-background-primary)',
          color: isDragOver || isDraggingAny ? 'var(--color-danger, #ef4444)' : 'var(--color-text-secondary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isDragOver ? '0 4px 14px rgba(239, 68, 68, 0.25)' : '0 2px 8px rgba(15, 23, 42, 0.02)',
          userSelect: 'none',
          transform: isDragOver ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>🗑️</span>
        <span className="hide-mobile" style={{ whiteSpace: 'nowrap' }}>
          {isDragOver ? 'Soltar para eliminar' : isDraggingAny ? 'Arrastra aquí' : 'Papelera'}
        </span>
      </div>

      <Modal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        title="¿Eliminar tarea?"
        titleId="delete-task-modal-title"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            ¿Estás seguro de que deseas eliminar la tarea{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{`"${taskToDelete?.name || ''}"`}</strong>?
          </p>

          {(taskToDelete?.subtasks?.length > 0 || (taskToDelete?.dependencyTaskIds && taskToDelete.dependencyTaskIds.length > 0)) && (
            <div style={{
              background: 'var(--color-background-secondary, rgba(239, 68, 68, 0.04))',
              borderLeft: '3px solid var(--color-danger, #ef4444)',
              padding: '10px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              color: 'var(--color-text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: 2 }}>⚠️ Impacto de la eliminación:</strong>
              {taskToDelete?.subtasks?.length > 0 && (
                <span>• Se eliminarán permanentemente las <strong>{taskToDelete.subtasks.length} subtarea{taskToDelete.subtasks.length !== 1 ? 's' : ''}</strong> del checklist.</span>
              )}
              {taskToDelete?.dependencyTaskIds?.length > 0 && (
                <span>• Se desvincularán las <strong>{taskToDelete.dependencyTaskIds.length} tarea{taskToDelete.dependencyTaskIds.length !== 1 ? 's' : ''} hija{taskToDelete.dependencyTaskIds.length !== 1 ? 's' : ''}</strong> asociadas (no se eliminarán).</span>
              )}
            </div>
          )}

          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            * Esta acción se puede revertir inmediatamente usando <strong>⌘Z</strong> o desde la notificación flotante.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setTaskToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              🗑️ Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
