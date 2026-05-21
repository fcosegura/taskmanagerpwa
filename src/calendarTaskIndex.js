export function indexTasksByDate(tasks) {
  const tByDate = {};
  const push = (dateStr, task, calendarDateRole) => {
    if (!dateStr) return;
    (tByDate[dateStr] = tByDate[dateStr] || []).push({ ...task, calendarDateRole });
  };
  tasks.forEach((task) => {
    const start = typeof task.date === 'string' ? task.date.trim() : '';
    const end = typeof task.endDate === 'string' ? task.endDate.trim() : '';
    if (start) push(start, task, 'start');
    if (end && end !== start) push(end, task, 'end');
  });
  return tByDate;
}
