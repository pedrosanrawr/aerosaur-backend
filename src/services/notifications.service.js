import * as repo from './notification.repo.js';

export const getFullNotificationData = async (userId) => {
  const [settings, history] = await Promise.all([
    repo.getSettings(userId),
    repo.getHistory(userId)
  ]);
  return { settings, history };
};

export const updatePreferences = async (userId, settingsData) => {
  return await repo.updateSettings(userId, settingsData);
};

export const performHistoryAction = async (userId, action) => {
  if (action === 'read_all') return await repo.markAllAsRead(userId);
  if (action === 'clear_all') return await repo.clearHistory(userId);
  throw new Error("Invalid Action");
};