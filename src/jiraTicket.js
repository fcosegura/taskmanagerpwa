export function isJiraCategory(category) {
  return typeof category === 'string' && category.toLowerCase().includes('jira');
}

export function normalizeTicketNumber(ticketNumber) {
  if (typeof ticketNumber !== 'string') return '';
  return ticketNumber.trim();
}

export function extractJiraTicketFromUrl(url) {
  if (typeof url !== 'string') return '';
  const source = url.trim();
  if (!source) return '';
  const match = source.match(/(?:^|\/)browse\/([A-Z][A-Z0-9]+-\d+)(?=$|[/?#&])/i);
  return match?.[1] ? normalizeTicketNumber(match[1]).toUpperCase() : '';
}

export function applyTicketNumberToTaskName(name, ticketNumber) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanTicket = normalizeTicketNumber(ticketNumber);
  if (!cleanTicket) return cleanName;
  const ticketSuffix = `[${cleanTicket}]`;
  const escapedSuffix = ticketSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasSameSuffix = new RegExp(`${escapedSuffix}$`).test(cleanName);
  if (hasSameSuffix) return cleanName;
  return `${cleanName} ${ticketSuffix}`.trim();
}

export function inheritTicketFromParentTask(parentTask, childTask) {
  const parentTicketNumber = normalizeTicketNumber(parentTask?.ticketNumber || '');
  if (!parentTicketNumber) return childTask;
  const childTicketNumber = normalizeTicketNumber(childTask?.ticketNumber || '');
  if (childTicketNumber) return childTask;
  return {
    ...childTask,
    ticketNumber: parentTicketNumber,
    name: applyTicketNumberToTaskName(childTask?.name || '', parentTicketNumber),
  };
}
