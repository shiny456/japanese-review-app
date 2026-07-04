import { BUILTIN_VOCAB, CATEGORIES } from './data/vocab.js';
import { DIALOGS } from './data/dialogs.js';
import { GRAMMAR, GRAMMAR_GROUPS } from './data/grammar.js';
import { store } from './storage.js';
import * as srs from './srs.js';
import { recognizeImage, parseCardText } from './ocr.js';

const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');

function allCards() {
  return [...BUILTIN_VOCAB, ...store.getCustomCards()];
}

function catName(id) {
  return CATEGORIES.find((c) => c.id === id)?.name || id;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ===== 日文發音（Web Speech API）=====
let jaVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  jaVoice = voices.find((v) => v.lang === 'ja-JP') || voices.find((v) => v.lang.startsWith('ja')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/〜/g, ''));
  u.lang = 'ja-JP';
  if (jaVoice) u.voice = jaVoice;
  u.rate = store.getSettings().ttsRate;
  speechSynthesis.speak(u);
}

function speakBtn(text, big = false) {
  return `<button class="btn-speak${big ? ' big' : ''}" data-speak="${esc(text)}" title="播放發音">🔊</button>`;
}

// 事件代理：發音按鈕在所有頁面都能用
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-speak]');
  if (btn) speak(btn.dataset.speak);
});

// ===== 路由 =====
const routes = {
  '': renderHome,
  home: renderHome,
  study: renderStudy,
  quiz: renderQuiz,
  talk: renderDialogList,
  dialog: renderDialog,
  grammar: renderGrammar,
  manage: renderManage,
};

function navigate() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = routes[page] || renderHome;
  speechSynthesis?.cancel?.();
  fn(arg);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const target = a.getAttribute('href').replace(/^#\/?/, '');
    a.classList.toggle('active', target === (page || 'home') || (target === 'talk' && page === 'dialog'));
  });
}
window.addEventListener('hashchange', navigate);

// ===== 首頁 =====
function renderHome() {
  const cards = allCards();
  const due = srs.countDue(cards);
  const learned = srs.countLearned(cards);
  const settings = store.getSettings();
  const newBudget = Math.max(0, settings.newPerDay - store.todayCount('newLearned'));
  const streak = store.streak();
  const reviewedToday = store.todayCount('reviewed');

  app.innerHTML = `
    <header class="hero">
      <h1>日語旅遊複習</h1>
      <p class="sub">日本語GOGO × 旅遊會話 · 目標：在日本開口說</p>
    </header>

    <div class="stat-row">
      <div class="stat"><div class="stat-num">${due}</div><div class="stat-label">待複習</div></div>
      <div class="stat"><div class="stat-num">${learned}</div><div class="stat-label">已學會</div></div>
      <div class="stat"><div class="stat-num">${reviewedToday}</div><div class="stat-label">今日已複習</div></div>
      <div class="stat"><div class="stat-num">${streak}🔥</div><div class="stat-label">連續天數</div></div>
    </div>

    <a class="card action-card" href="#/study">
      <div class="action-icon">🎴</div>
      <div><h2>單字卡複習</h2><p>${due > 0 ? `${due} 張到期` : '沒有到期卡片'}${newBudget > 0 ? ` · 可學 ${newBudget} 張新卡` : ''}</p></div>
    </a>
    <a class="card action-card" href="#/talk">
      <div class="action-icon">💬</div>
      <div><h2>情境會話</h2><p>點餐、問路、購物…實戰對話練習</p></div>
    </a>
    <a class="card action-card" href="#/grammar">
      <div class="action-icon">📖</div>
      <div><h2>文法庫</h2><p>${GRAMMAR.length} 個句型重點，含例句與解說</p></div>
    </a>
    <a class="card action-card" href="#/quiz">
      <div class="action-icon">✏️</div>
      <div><h2>選擇題測驗</h2><p>單字＋文法題，順便為日檢暖身</p></div>
    </a>
    <a class="card action-card" href="#/manage">
      <div class="action-icon">📥</div>
      <div><h2>單字管理與匯入</h2><p>拍課本照片或貼上文字，快速加卡片</p></div>
    </a>

    <div class="card settings-card">
      <h3>設定</h3>
      <label>每日新卡上限
        <select id="set-newperday">
          ${[5, 10, 15, 20, 30].map((n) => `<option value="${n}" ${settings.newPerDay === n ? 'selected' : ''}>${n} 張</option>`).join('')}
        </select>
      </label>
      <label>卡片正面
        <select id="set-front">
          <option value="jp" ${settings.front === 'jp' ? 'selected' : ''}>日文 → 中文</option>
          <option value="zh" ${settings.front === 'zh' ? 'selected' : ''}>中文 → 日文</option>
          <option value="mix" ${settings.front === 'mix' ? 'selected' : ''}>隨機混合</option>
        </select>
      </label>
      <label>發音速度
        <select id="set-rate">
          <option value="0.7" ${settings.ttsRate === 0.7 ? 'selected' : ''}>慢</option>
          <option value="0.85" ${settings.ttsRate === 0.85 ? 'selected' : ''}>正常偏慢</option>
          <option value="1" ${settings.ttsRate === 1 ? 'selected' : ''}>正常</option>
        </select>
      </label>
    </div>
  `;

  const saveSettings = () => {
    store.saveSettings({
      ...store.getSettings(),
      newPerDay: Number($('#set-newperday').value),
      front: $('#set-front').value,
      ttsRate: Number($('#set-rate').value),
    });
  };
  $('#set-newperday').onchange = saveSettings;
  $('#set-front').onchange = saveSettings;
  $('#set-rate').onchange = saveSettings;
}

// ===== 單字卡複習（SRS）=====
let session = null;

function renderStudy() {
  const { due, fresh } = srs.buildQueue(allCards());
  session = { queue: [...due, ...fresh], done: 0, total: due.length + fresh.length, newIds: new Set(fresh.map((c) => c.id)) };
  nextCard();
}

function nextCard() {
  // 撿回 10 分鐘內又到期的卡（答錯的卡會回到佇列）
  if (session.queue.length === 0) {
    const again = allCards().filter((c) => {
      const s = srs.getState(c.id);
      return s && s.due > 0 && s.due <= Date.now();
    });
    if (again.length > 0) session.queue.push(...again);
  }

  if (session.queue.length === 0) {
    app.innerHTML = `
      <div class="finish-screen">
        <div class="finish-icon">🎉</div>
        <h2>今天的複習完成！</h2>
        <p>共複習了 ${session.done} 張卡片</p>
        <a class="btn primary" href="#/quiz">來個小測驗</a>
        <a class="btn" href="#/home">回首頁</a>
      </div>`;
    return;
  }

  const card = session.queue.shift();
  const settings = store.getSettings();
  const front = settings.front === 'mix' ? (Math.random() < 0.5 ? 'jp' : 'zh') : settings.front;
  const isNew = session.newIds.has(card.id) && !srs.getState(card.id);
  const preview = srs.previewIntervals(srs.getState(card.id));

  const frontHTML = front === 'jp'
    ? `<div class="card-jp">${esc(card.jp)}</div>${speakBtn(card.kana || card.jp, true)}`
    : `<div class="card-zh">${esc(card.zh)}</div>`;
  const backHTML = `
    <div class="card-jp">${esc(card.jp)}</div>
    <div class="card-kana">${esc(card.kana)}</div>
    <div class="card-zh">${esc(card.zh)}</div>
    ${speakBtn(card.kana || card.jp, true)}
    <div class="card-cat">${esc(catName(card.cat))}</div>
  `;

  app.innerHTML = `
    <div class="study-top">
      <a href="#/home" class="btn-back">←</a>
      <div class="progress-text">剩 ${session.queue.length + 1} 張${isNew ? ' · <span class="tag-new">新卡</span>' : ''}</div>
    </div>
    <div class="flashcard" id="flashcard">
      <div class="fc-face" id="fc-front">${frontHTML}<div class="tap-hint">點一下看答案</div></div>
      <div class="fc-face hidden" id="fc-back">${backHTML}</div>
    </div>
    <div class="grade-row hidden" id="grade-row">
      ${srs.GRADES.map((g) => `
        <button class="btn-grade ${g.cls}" data-grade="${g.key}">
          ${g.label}<span class="grade-hint">${g.key === 'again' ? preview.again : preview[g.key]}</span>
        </button>`).join('')}
    </div>
  `;

  const flip = () => {
    $('#fc-front').classList.add('hidden');
    $('#fc-back').classList.remove('hidden');
    $('#grade-row').classList.remove('hidden');
    if (front === 'jp') speak(card.kana || card.jp);
  };
  $('#flashcard').addEventListener('click', (e) => {
    if (!e.target.closest('[data-speak]') && $('#fc-back').classList.contains('hidden')) flip();
  });
  $('#grade-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-grade]');
    if (!btn) return;
    srs.grade(card.id, btn.dataset.grade);
    session.done++;
    nextCard();
  });
}

// ===== 選擇題測驗 =====
function renderQuiz() {
  const cards = allCards();
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, cards.filter((k) => k.cat === c.id).length]));

  app.innerHTML = `
    <header class="page-head"><a href="#/home" class="btn-back">←</a><h1>選擇題測驗</h1></header>
    <div class="card">
      <h3>出題來源</h3>
      <label class="radio-line"><input type="radio" name="qsrc" value="vocab" checked> 單字題</label>
      <label class="radio-line"><input type="radio" name="qsrc" value="grammar"> 文法題（填空選擇）</label>
      <label class="radio-line"><input type="radio" name="qsrc" value="both"> 單字＋文法混合</label>
      <div id="vocab-opts">
        <h3>單字範圍</h3>
        <div class="cat-grid" id="quiz-cats">
          ${CATEGORIES.filter((c) => counts[c.id] > 0).map((c) => `
            <label class="cat-chip"><input type="checkbox" value="${c.id}" checked> ${c.icon} ${c.name} (${counts[c.id]})</label>
          `).join('')}
        </div>
        <h3>單字題型</h3>
        <label class="radio-line"><input type="radio" name="qdir" value="jp2zh" checked> 看日文選中文</label>
        <label class="radio-line"><input type="radio" name="qdir" value="zh2jp"> 看中文選日文</label>
        <label class="radio-line"><input type="radio" name="qdir" value="mix"> 混合</label>
      </div>
      <button class="btn primary full" id="quiz-start">開始測驗（10 題）</button>
    </div>
  `;

  document.querySelectorAll('input[name="qsrc"]').forEach((r) => {
    r.onchange = () => $('#vocab-opts').classList.toggle('hidden', r.value === 'grammar' && r.checked);
  });

  $('#quiz-start').onclick = () => {
    const src = document.querySelector('input[name="qsrc"]:checked').value;
    const cats = [...document.querySelectorAll('#quiz-cats input:checked')].map((i) => i.value);
    const dir = document.querySelector('input[name="qdir"]:checked').value;
    const pool = cards.filter((c) => cats.includes(c.cat) && c.zh);
    if (src !== 'grammar' && pool.length < 4) {
      alert('選擇的範圍至少要有 4 個單字才能出題');
      return;
    }
    startQuiz(pool, dir, src);
  };
}

function vocabQuestion(card, pool, dir) {
  const qDir = dir === 'mix' ? (Math.random() < 0.5 ? 'jp2zh' : 'zh2jp') : dir;
  const distractors = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, 3);
  const options = shuffle([card, ...distractors]);
  return { type: 'vocab', card, qDir, options };
}

function grammarQuestions(count) {
  const items = GRAMMAR.flatMap((g) => g.quiz.map((item) => ({ type: 'grammar', g, item })));
  return shuffle(items).slice(0, count);
}

function startQuiz(pool, dir, src = 'vocab') {
  let questions = [];
  if (src === 'vocab') {
    questions = shuffle([...pool]).slice(0, 10).map((c) => vocabQuestion(c, pool, dir));
  } else if (src === 'grammar') {
    questions = grammarQuestions(10);
  } else {
    const v = shuffle([...pool]).slice(0, 5).map((c) => vocabQuestion(c, pool, dir));
    questions = shuffle([...v, ...grammarQuestions(5)]);
  }
  const state = { questions, index: 0, correct: 0, wrong: [] };
  showQuestion(state);
}

function showQuestion(state) {
  if (state.index >= state.questions.length) {
    const pct = Math.round((state.correct / state.questions.length) * 100);
    app.innerHTML = `
      <div class="finish-screen">
        <div class="finish-icon">${pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '💪'}</div>
        <h2>${state.correct} / ${state.questions.length}</h2>
        <p>${pct >= 80 ? '太棒了！' : pct >= 60 ? '不錯，再接再厲！' : '多複習幾次就會了！'}</p>
        ${state.wrong.length > 0 ? `
          <div class="card wrong-list">
            <h3>答錯的題目</h3>
            ${state.wrong.map((w) => `
              <div class="wrong-item">
                <div><b>${esc(w.jp)}</b> ${w.kana ? `<span class="kana-small">${esc(w.kana)}</span>` : ''}<br>${esc(w.zh)}</div>
                ${w.tts ? speakBtn(w.tts) : ''}
              </div>`).join('')}
          </div>` : ''}
        <a class="btn primary" href="#/quiz">再測一次</a>
        <a class="btn" href="#/home">回首頁</a>
      </div>`;
    return;
  }

  const q = state.questions[state.index];
  const head = `
    <div class="study-top">
      <a href="#/quiz" class="btn-back">←</a>
      <div class="progress-text">第 ${state.index + 1} / ${state.questions.length} 題</div>
    </div>`;

  if (q.type === 'grammar') {
    const { g, item } = q;
    app.innerHTML = `
      ${head}
      <div class="quiz-prompt">
        <div class="challenge-hint">文法填空 · ${esc(g.meaning)}</div>
        <div class="card-jp gram-q">${esc(item.q)}</div>
      </div>
      <div class="quiz-options">
        ${item.options.map((opt, i) => `<button class="btn-option center" data-i="${i}">${esc(opt)}</button>`).join('')}
      </div>
      <div class="quiz-hint hidden" id="quiz-hint"></div>
    `;
    document.querySelectorAll('.btn-option').forEach((btn) => {
      btn.onclick = () => {
        const chosenIdx = Number(btn.dataset.i);
        const isCorrect = chosenIdx === item.answer;
        document.querySelectorAll('.btn-option').forEach((b, i) => {
          b.disabled = true;
          if (i === item.answer) b.classList.add('correct');
          else if (b === btn) b.classList.add('incorrect');
        });
        if (isCorrect) {
          state.correct++;
        } else {
          state.wrong.push({
            jp: `${g.pattern}`,
            kana: item.q.replace('___', `【${item.options[item.answer]}】`),
            zh: `${g.meaning}。${item.hint}`,
            tts: null,
          });
          const hintEl = $('#quiz-hint');
          hintEl.textContent = `💡 ${item.hint}`;
          hintEl.classList.remove('hidden');
        }
        setTimeout(() => { state.index++; showQuestion(state); }, isCorrect ? 700 : 2400);
      };
    });
    return;
  }

  const isJp2Zh = q.qDir === 'jp2zh';
  const prompt = isJp2Zh
    ? `<div class="card-jp">${esc(q.card.jp)}</div><div class="card-kana">${esc(q.card.kana)}</div>${speakBtn(q.card.kana || q.card.jp)}`
    : `<div class="card-zh big">${esc(q.card.zh)}</div>`;

  app.innerHTML = `
    ${head}
    <div class="quiz-prompt">${prompt}</div>
    <div class="quiz-options">
      ${q.options.map((opt, i) => `
        <button class="btn-option" data-i="${i}">
          ${isJp2Zh ? esc(opt.zh) : `${esc(opt.jp)}<span class="kana-small">${esc(opt.kana)}</span>`}
        </button>`).join('')}
    </div>
  `;

  document.querySelectorAll('.btn-option').forEach((btn) => {
    btn.onclick = () => {
      const chosen = q.options[Number(btn.dataset.i)];
      const isCorrect = chosen.id === q.card.id;
      document.querySelectorAll('.btn-option').forEach((b, i) => {
        b.disabled = true;
        if (q.options[i].id === q.card.id) b.classList.add('correct');
        else if (b === btn) b.classList.add('incorrect');
      });
      if (isCorrect) state.correct++;
      else state.wrong.push({ jp: q.card.jp, kana: q.card.kana, zh: q.card.zh, tts: q.card.kana || q.card.jp });
      if (!isJp2Zh || !isCorrect) speak(q.card.kana || q.card.jp);
      setTimeout(() => { state.index++; showQuestion(state); }, isCorrect ? 700 : 1600);
    };
  });
}

// ===== 情境會話 =====
function renderDialogList() {
  app.innerHTML = `
    <header class="page-head"><a href="#/home" class="btn-back">←</a><h1>情境會話</h1></header>
    <p class="sub-note">先「跟讀」熟悉整段對話，再用「填空挑戰」測試自己記不記得。</p>
    ${DIALOGS.map((d) => `
      <a class="card action-card" href="#/dialog/${d.id}">
        <div class="action-icon">${d.icon}</div>
        <div><h2>${esc(d.title)}</h2><p>${esc(d.desc)} · ${d.lines.length} 句</p></div>
      </a>`).join('')}
  `;
}

function renderDialog(id) {
  const dialog = DIALOGS.find((d) => d.id === id);
  if (!dialog) { location.hash = '#/talk'; return; }

  app.innerHTML = `
    <header class="page-head"><a href="#/talk" class="btn-back">←</a><h1>${dialog.icon} ${esc(dialog.title)}</h1></header>
    <div class="dialog-controls">
      <button class="btn small" id="toggle-kana">假名：開</button>
      <button class="btn small" id="toggle-zh">中文：開</button>
      <button class="btn small primary" id="start-challenge">🎯 填空挑戰</button>
    </div>
    <div class="dialog-lines">
      ${dialog.lines.map((l) => `
        <div class="bubble-row ${l.speaker}">
          <div class="bubble">
            <div class="bubble-role">${esc(l.role)}</div>
            <div class="bubble-jp">${esc(l.jp)}</div>
            <div class="bubble-kana">${esc(l.kana)}</div>
            <div class="bubble-zh">${esc(l.zh)}</div>
          </div>
          ${speakBtn(l.kana || l.jp)}
        </div>`).join('')}
    </div>
  `;

  let kanaOn = true, zhOn = true;
  $('#toggle-kana').onclick = () => {
    kanaOn = !kanaOn;
    $('#toggle-kana').textContent = `假名：${kanaOn ? '開' : '關'}`;
    document.querySelectorAll('.bubble-kana').forEach((el) => el.classList.toggle('hidden', !kanaOn));
  };
  $('#toggle-zh').onclick = () => {
    zhOn = !zhOn;
    $('#toggle-zh').textContent = `中文：${zhOn ? '開' : '關'}`;
    document.querySelectorAll('.bubble-zh').forEach((el) => el.classList.toggle('hidden', !zhOn));
  };
  $('#start-challenge').onclick = () => startDialogChallenge(dialog);
}

// 填空挑戰：逐句顯示中文，從整段對話的「你」的台詞中選出正確日文
function startDialogChallenge(dialog) {
  const yourLines = dialog.lines.filter((l) => l.speaker === 'you');
  if (yourLines.length < 2) return;
  const state = { lines: shuffle([...yourLines]), index: 0, correct: 0 };

  const step = () => {
    if (state.index >= state.lines.length) {
      app.innerHTML = `
        <div class="finish-screen">
          <div class="finish-icon">${state.correct === state.lines.length ? '🏆' : '👍'}</div>
          <h2>${state.correct} / ${state.lines.length}</h2>
          <p>「${esc(dialog.title)}」情境挑戰完成</p>
          <a class="btn primary" href="#/dialog/${dialog.id}">回到對話</a>
          <a class="btn" href="#/talk">其他情境</a>
        </div>`;
      return;
    }
    const target = state.lines[state.index];
    const options = shuffle([target, ...shuffle(yourLines.filter((l) => l.jp !== target.jp)).slice(0, 3)]);

    app.innerHTML = `
      <div class="study-top">
        <a href="#/dialog/${dialog.id}" class="btn-back">←</a>
        <div class="progress-text">${dialog.icon} ${state.index + 1} / ${state.lines.length}</div>
      </div>
      <div class="quiz-prompt"><div class="challenge-hint">這句日文怎麼說？</div><div class="card-zh big">${esc(target.zh)}</div></div>
      <div class="quiz-options">
        ${options.map((opt, i) => `<button class="btn-option" data-i="${i}">${esc(opt.jp)}</button>`).join('')}
      </div>
    `;

    document.querySelectorAll('.btn-option').forEach((btn) => {
      btn.onclick = () => {
        const chosen = options[Number(btn.dataset.i)];
        const ok = chosen.jp === target.jp;
        document.querySelectorAll('.btn-option').forEach((b, i) => {
          b.disabled = true;
          if (options[i].jp === target.jp) b.classList.add('correct');
          else if (b === btn) b.classList.add('incorrect');
        });
        if (ok) state.correct++;
        speak(target.kana || target.jp);
        setTimeout(() => { state.index++; step(); }, ok ? 900 : 1800);
      };
    });
  };
  step();
}

// ===== 文法庫 =====
function renderGrammar() {
  app.innerHTML = `
    <header class="page-head"><a href="#/home" class="btn-back">←</a><h1>📖 文法庫</h1></header>
    <p class="sub-note">點句型展開解說和例句。想測驗的話到「測驗」頁選「文法題」。</p>
    ${GRAMMAR_GROUPS.map((group) => `
      <h3 class="gram-group">${esc(group)}</h3>
      ${GRAMMAR.filter((g) => g.lesson === group).map((g) => `
        <details class="card gram-item">
          <summary>
            <span class="gram-pattern">${esc(g.pattern)}</span>
            <span class="gram-meaning">${esc(g.meaning)}</span>
          </summary>
          <p class="gram-explain">${esc(g.explain)}</p>
          ${g.examples.map((ex) => `
            <div class="gram-example">
              <div>
                <div class="bubble-jp">${esc(ex.jp)}</div>
                <div class="bubble-kana">${esc(ex.kana)}</div>
                <div class="bubble-zh">${esc(ex.zh)}</div>
              </div>
              ${speakBtn(ex.kana || ex.jp)}
            </div>`).join('')}
        </details>`).join('')}
    `).join('')}
    <a class="btn primary full" href="#/quiz">✏️ 去做文法測驗</a>
  `;
}

// ===== 單字管理與匯入 =====
function renderManage() {
  const custom = store.getCustomCards();

  app.innerHTML = `
    <header class="page-head"><a href="#/home" class="btn-back">←</a><h1>單字管理與匯入</h1></header>

    <div class="card">
      <h3>📱 手機拍照最準的方法（推薦）</h3>
      <p class="sub-note">用手機相機拍課本後，<b>在照片上長按文字 → 全選 → 拷貝</b>（iPhone 的「原況文字」或 Android 的 Google 智慧鏡頭），再貼到下面的「貼上文字匯入」。手機內建辨識比網頁 OCR 準確很多。</p>
    </div>

    <div class="card">
      <h3>📋 貼上文字匯入</h3>
      <p class="sub-note">每行一個單字：「日文,假名,中文」或「日文,中文」（逗號、頓號、Tab、斜線都可以）</p>
      <textarea id="paste-input" rows="5" placeholder="例：&#10;水,みず,水&#10;お手洗い,おてあらい,洗手間"></textarea>
      <button class="btn primary full" id="parse-btn">解析成卡片</button>
    </div>

    <div class="card">
      <h3>📷 網頁 OCR 辨識（備用）</h3>
      <p class="sub-note">沒辦法用上面的方法時，也可以直接上傳照片辨識。日文部分準確度尚可，中文意思常會認錯，記得在確認畫面修正。</p>
      <input type="file" id="ocr-file" accept="image/*" capture="environment" class="hidden">
      <button class="btn full" id="ocr-btn">選擇照片 / 拍照</button>
      <div id="ocr-status" class="hidden"><div class="ocr-bar"><div class="ocr-fill" id="ocr-fill"></div></div><p id="ocr-msg">辨識中…第一次使用需下載辨識模型（約 15MB），請稍候</p></div>
    </div>

    <div class="card hidden" id="preview-card">
      <h3>確認匯入內容（可直接修改）</h3>
      <div id="preview-rows"></div>
      <button class="btn primary full" id="confirm-import">✅ 加入單字庫</button>
    </div>

    <div class="card">
      <h3>📝 我的單字（${custom.length}）</h3>
      ${custom.length === 0 ? '<p class="sub-note">還沒有自訂單字，用上面的方式匯入吧！</p>' : `
        <div class="custom-list">
          ${custom.map((c) => `
            <div class="custom-item">
              <div><b>${esc(c.jp)}</b> <span class="kana-small">${esc(c.kana)}</span><br><span class="zh-small">${esc(c.zh)}</span></div>
              <div class="custom-actions">${speakBtn(c.kana || c.jp)}<button class="btn-del" data-del="${c.id}">🗑</button></div>
            </div>`).join('')}
        </div>`}
    </div>

    <div class="card">
      <h3>💾 備份與還原</h3>
      <p class="sub-note">學習進度存在這台裝置的瀏覽器裡。換裝置前先匯出備份。</p>
      <div class="btn-row">
        <button class="btn" id="export-btn">匯出備份</button>
        <button class="btn" id="import-backup-btn">還原備份</button>
        <input type="file" id="backup-file" accept=".json" class="hidden">
      </div>
    </div>
  `;

  let pending = [];

  const showPreview = (cards) => {
    if (cards.length === 0) {
      alert('沒有解析出任何單字，請檢查格式或照片品質');
      return;
    }
    pending = cards;
    $('#preview-card').classList.remove('hidden');
    $('#preview-rows').innerHTML = cards.map((c, i) => `
      <div class="preview-row" data-i="${i}">
        <input value="${esc(c.jp)}" data-field="jp" placeholder="日文">
        <input value="${esc(c.kana)}" data-field="kana" placeholder="假名">
        <input value="${esc(c.zh)}" data-field="zh" placeholder="中文">
        <button class="btn-del" data-remove="${i}">✕</button>
      </div>`).join('');
    $('#preview-card').scrollIntoView({ behavior: 'smooth' });
  };

  $('#preview-rows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) {
      pending.splice(Number(btn.dataset.remove), 1);
      showPreview(pending);
    }
  });

  $('#parse-btn').onclick = () => showPreview(parseCardText($('#paste-input').value));

  $('#ocr-btn').onclick = () => $('#ocr-file').click();
  $('#ocr-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $('#ocr-status').classList.remove('hidden');
    $('#ocr-fill').style.width = '0%';
    try {
      const text = await recognizeImage(file, (p) => {
        $('#ocr-fill').style.width = `${Math.round(p * 100)}%`;
      });
      $('#ocr-status').classList.add('hidden');
      $('#paste-input').value = text.trim();
      showPreview(parseCardText(text));
    } catch (err) {
      $('#ocr-msg').textContent = `辨識失敗：${err.message}。也可以改用貼上文字的方式匯入。`;
    }
  };

  $('#confirm-import').onclick = () => {
    const rows = [...document.querySelectorAll('.preview-row')];
    const cards = rows.map((row) => {
      const get = (f) => row.querySelector(`[data-field="${f}"]`).value.trim();
      return { id: `c${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, jp: get('jp'), kana: get('kana'), zh: get('zh'), cat: 'custom' };
    }).filter((c) => c.jp && c.zh);
    if (cards.length === 0) {
      alert('每張卡片至少要有日文和中文');
      return;
    }
    store.saveCustomCards([...store.getCustomCards(), ...cards]);
    alert(`已加入 ${cards.length} 張卡片！`);
    renderManage();
  };

  app.addEventListener('click', function onDel(e) {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    if (!confirm('確定刪除這張卡片？')) return;
    store.saveCustomCards(store.getCustomCards().filter((c) => c.id !== btn.dataset.del));
    renderManage();
  }, { once: true });

  $('#export-btn').onclick = () => {
    const blob = new Blob([store.exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `japanese-review-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $('#import-backup-btn').onclick = () => $('#backup-file').click();
  $('#backup-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      store.importAll(await file.text());
      alert('還原完成！');
      renderManage();
    } catch {
      alert('檔案格式不正確');
    }
  };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 離線支援
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

navigate();
