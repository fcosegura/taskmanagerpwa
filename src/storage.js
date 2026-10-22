// Compatibility entry point. New code imports the module responsible for each operation.
export { isValidTask, isValidEvent, isValidBoardNote, validateBackupPayload, normalizeDataPayload, isMultiBackupPayload, validateMultiBackupPayload, normalizeMultiBackupPayload } from './data/normalize.js';
export { fetchWorkspaceData, loadData, saveData } from './data/cloudSync.js';
export { cacheNoteAiMetaLocal, loadCachedNoteAiMeta } from './data/localStore.js';
export { fetchCloudReadWithRetry } from './api/cloudRead.js';
export { loginWithGoogleCredential, logoutSession, checkSession } from './api/auth.js';
export { createProfile, deleteProfile, updateProfileStatuses } from './api/profiles.js';
export { parseTaskWithAI, generateTasksFromText, generateDailyStatus } from './api/taskAi.js';
export { fetchNoteAiMeta, searchNotesSemantic, fetchRelatedNotes, dismissNoteAiSuggestionClient, fetchNoteDuplicates, fetchNotesOrganizeLayout, chatNotesRag } from './api/noteAi.js';
