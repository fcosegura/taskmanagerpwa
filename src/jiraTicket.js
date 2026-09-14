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

export function extractJiraProjectKeyFromUrl(url) {
  const ticketNumber = extractJiraTicketFromUrl(url);
  if (!ticketNumber) return '';
  return ticketNumber.split('-')[0] || '';
}

export function getJiraTaskDefaultsFromUrl(url) {
  const projectKey = extractJiraProjectKeyFromUrl(url);
  if (projectKey !== 'MAPP') return null;
  return {
    category: 'Jira Task',
    priority: 'high',
  };
}

export function applyJiraAutofillFromUrl(form, url) {
  if (typeof url !== 'string' || !url.trim()) return form;

  const next = { ...form };
  const ticketFromUrl = extractJiraTicketFromUrl(url);
  if (ticketFromUrl && !normalizeTicketNumber(next.ticketNumber || '')) {
    next.ticketNumber = ticketFromUrl;
  }

  const jiraDefaults = getJiraTaskDefaultsFromUrl(url);
  if (jiraDefaults) {
    if (!next.category) {
      next.category = jiraDefaults.category;
    }
    if ((next.priority || 'medium') === 'medium') {
      next.priority = jiraDefaults.priority;
    }
  }

  const ticket = normalizeTicketNumber(next.ticketNumber || '');
  if (ticket) {
    const nextName = applyTicketNumberToTaskName(next.name || '', ticket);
    if (nextName !== (next.name || '').trim()) {
      next.name = nextName;
    }
  }

  return next;
}

export function applyTicketNumberToTaskName(name, ticketNumber) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanTicket = normalizeTicketNumber(ticketNumber).toUpperCase();
  if (!cleanTicket) return cleanName;
  const existingTicketToken = /\[[A-Z][A-Z0-9]+-\d+\]/gi;
  const withoutTicket = cleanName
    .replace(existingTicketToken, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return `${withoutTicket} [${cleanTicket}]`.trim();
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
