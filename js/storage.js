// localStorage 封裝：SRS 進度、自訂單字、設定
const KEYS = {
  progress: 'jr_progress',
  custom: 'jr_custom_cards',
  settings: 'jr_settings',
  stats: 'jr_stats',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const store = {
  getProgress: () => load(KEYS.progress, {}),
  saveProgress: (p) => save(KEYS.progress, p),

  getCustomCards: () => load(KEYS.custom, []),
  saveCustomCards: (cards) => save(KEYS.custom, cards),

  getSettings: () => ({ newPerDay: 10, front: 'jp', ttsRate: 0.85, ...load(KEYS.settings, {}) }),
  saveSettings: (s) => save(KEYS.settings, s),

  getStats: () => load(KEYS.stats, { days: {} }),
  saveStats: (s) => save(KEYS.stats, s),

  // 記錄今天複習了幾張（用來顯示連續天數與今日進度）
  bumpToday(field) {
    const stats = this.getStats();
    const today = new Date().toISOString().slice(0, 10);
    if (!stats.days[today]) stats.days[today] = { reviewed: 0, newLearned: 0 };
    stats.days[today][field] = (stats.days[today][field] || 0) + 1;
    this.saveStats(stats);
  },

  todayCount(field) {
    const today = new Date().toISOString().slice(0, 10);
    return this.getStats().days[today]?.[field] || 0;
  },

  streak() {
    const days = this.getStats().days;
    let n = 0;
    const d = new Date();
    // 今天沒讀不中斷（還沒讀而已），從今天或昨天開始往回數
    if (!days[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
    while (days[d.toISOString().slice(0, 10)]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  },

  exportAll() {
    return JSON.stringify({
      progress: this.getProgress(),
      custom: this.getCustomCards(),
      settings: this.getSettings(),
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  },

  importAll(json) {
    const data = JSON.parse(json);
    if (data.progress) save(KEYS.progress, data.progress);
    if (data.custom) save(KEYS.custom, data.custom);
    if (data.settings) save(KEYS.settings, data.settings);
    if (data.stats) save(KEYS.stats, data.stats);
  },
};
