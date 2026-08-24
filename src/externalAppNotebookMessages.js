export function isCreateNotebookSuccess(data) {
  return data?.ok === true || data?.success === true;
}

export function getCreateNotebookErrorDetails(data) {
  if (typeof data?.error === 'string') {
    return { code: data.error, message: data.message };
  }

  if (data?.error && typeof data.error === 'object') {
    return {
      code: data.error.code,
      message: data.error.message || data.message
    };
  }

  return { code: undefined, message: data?.message };
}

export function isVaultLockedError(code) {
  return code === 'vault-locked' || code === 'locked';
}
