let mockSettings = {
  notifications: true,
  alerts: true,
  smartMode: true,
  energyUsage: true
};

let mockHistory = [
  { id: 1, type: "alert", title: "Poor Air Quality Detected", body: "AQI has reached 95 (High)", time: "11:32 | Today", isRead: false },
  { id: 2, type: "smart", title: "Smart Mode", body: "Automatically adjusted fan speed to 'Slow'", time: "08:32 | Today", isRead: true },
  { id: 3, type: "energy", title: "Energy Usage Warning", body: "Device has been running for 11 hours", time: "13:03 | Yesterday", isRead: true }
];

export const getSettings = async (userId) => mockSettings;

export const updateSettings = async (userId, data) => {
  mockSettings = { ...mockSettings, ...data };
  return mockSettings;
};

export const getHistory = async (userId) => mockHistory;

export const markAllAsRead = async (userId) => {
  mockHistory = mockHistory.map(h => ({ ...h, isRead: true }));
  return mockHistory;
};

export const clearHistory = async (userId) => {
  mockHistory = [];
  return [];
};