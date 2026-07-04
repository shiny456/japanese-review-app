// 簡化版 SM-2 間隔重複演算法
// 每張卡的狀態：{ ease, interval(天), due(timestamp), reps, lapses }
import { store } from './storage.js';

const DAY = 24 * 60 * 60 * 1000;
const AGAIN_DELAY = 10 * 60 * 1000; // 答錯 10 分鐘後重出

export const GRADES = [
  { key: 'again', label: '忘記了', hint: '10 分鐘後', cls: 'grade-again' },
  { key: 'hard', label: '有點難', hint: '', cls: 'grade-hard' },
  { key: 'good', label: '記得', hint: '', cls: 'grade-good' },
  { key: 'easy', label: '很簡單', hint: '', cls: 'grade-easy' },
];

function newState() {
  return { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
}

export function getState(cardId) {
  return store.getProgress()[cardId] || null;
}

// 預覽各評分後的下次間隔（顯示在按鈕上）
export function previewIntervals(state) {
  const s = state || newState();
  return {
    again: '10分',
    hard: fmtDays(nextInterval(s, 'hard')),
    good: fmtDays(nextInterval(s, 'good')),
    easy: fmtDays(nextInterval(s, 'easy')),
  };
}

function nextInterval(s, grade) {
  if (s.reps === 0) {
    return { hard: 0.5, good: 1, easy: 4 }[grade];
  }
  const base = Math.max(s.interval, 1);
  if (grade === 'hard') return Math.max(base * 1.2, 1);
  if (grade === 'good') return base * s.ease;
  return base * s.ease * 1.3; // easy
}

function fmtDays(d) {
  if (d < 1) return '12小時';
  if (d < 30) return `${Math.round(d)}天`;
  return `${(d / 30).toFixed(1)}個月`;
}

export function grade(cardId, gradeKey) {
  const progress = store.getProgress();
  const s = progress[cardId] || newState();
  const isNew = s.reps === 0;

  if (gradeKey === 'again') {
    s.lapses += s.reps > 0 ? 1 : 0;
    s.reps = 0;
    s.interval = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = Date.now() + AGAIN_DELAY;
  } else {
    if (gradeKey === 'hard') s.ease = Math.max(1.3, s.ease - 0.15);
    if (gradeKey === 'easy') s.ease += 0.1;
    s.interval = nextInterval(s, gradeKey);
    s.reps += 1;
    s.due = Date.now() + s.interval * DAY;
  }

  progress[cardId] = s;
  store.saveProgress(progress);
  store.bumpToday('reviewed');
  if (isNew && gradeKey !== 'again') store.bumpToday('newLearned');
}

// 組出今天的學習佇列：到期的複習卡 + 新卡（受每日上限限制）
export function buildQueue(allCards) {
  const progress = store.getProgress();
  const settings = store.getSettings();
  const now = Date.now();

  const due = [];
  const fresh = [];
  for (const card of allCards) {
    const s = progress[card.id];
    if (s && s.reps >= 0 && s.due > 0) {
      if (s.due <= now) due.push(card);
    } else {
      fresh.push(card);
    }
  }

  const newBudget = Math.max(0, settings.newPerDay - store.todayCount('newLearned'));
  // 複習卡優先，新卡照題庫順序（跟課本進度走）
  return { due, fresh: fresh.slice(0, newBudget), totalNew: fresh.length };
}

export function countDue(allCards) {
  const progress = store.getProgress();
  const now = Date.now();
  return allCards.filter((c) => {
    const s = progress[c.id];
    return s && s.due > 0 && s.due <= now;
  }).length;
}

export function countLearned(allCards) {
  const progress = store.getProgress();
  return allCards.filter((c) => progress[c.id] && progress[c.id].reps > 0).length;
}
