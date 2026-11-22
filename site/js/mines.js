/* 진우주 기자 학교 — 오보찾기: 지뢰찾기(D020·D021). 함정은 오보찾기 문제 은행(quiz.js)의 4지선다 문항.
   규칙은 고전 지뢰찾기 그대로: 숫자 = 주변 8칸의 함정 수, 깃발, 첫 칸은 늘 안전, 숫자 칸을 다시 누르면 주변을 한꺼번에 연다.
   함정(지뢰)은 기사 속 오보 유형이다. 밟으면 4지선다 — 맞히면 해체, 틀리면 ❤️ 하나를 잃는다. 해설은 선지마다. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, G = PHD.game;
  var esc = U.esc;
  var LEVELS = {
    easy: { name: '수습', cols: 8, rows: 8, mines: 8, xp: 5 },
    mid: { name: '기자', cols: 8, rows: 11, mines: 13, xp: 8 },
    hard: { name: '데스크', cols: 9, rows: 13, mines: 20, xp: 12 }
  };
  var HEARTS = 3;
  var st = null, traps = null, byTrap = {}, disc = null, mode = 'open', pending = null, press = null, suppress = false, timer = null;

  function A() { return PHD.app; }
  function today() { return U.studyDate(A().settings().dayStartHour); }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function L() { return LEVELS[st.level] || LEVELS.easy; }

  function load() {
    return Promise.all([S.get('meta', 'mines'), PHD.quiz.load(), G.loadDiscover()]).then(function (res) {
      traps = res[1];
      byTrap = {};
      traps.forEach(function (t) { byTrap[t.id] = t; });
      disc = res[2];
      var s = res[0];
      st = s && Array.isArray(s.mine) && LEVELS[s.level] && s.mine.length === LEVELS[s.level].cols * LEVELS[s.level].rows ? s : fresh((s && s.level) || 'easy', s);
      return st;
    });
  }
  function fresh(level, prev) {
    var lv = LEVELS[level] || LEVELS.easy, n = lv.cols * lv.rows, s = { key: 'mines', level: LEVELS[level] ? level : 'easy', mine: [], open: [], flag: [], trap: [], hit: {}, hearts: HEARTS, started: false, over: false, won: false, t0: 0, t1: 0, best: (prev && prev.best) || {}, wins: (prev && prev.wins) || 0 };
    for (var i = 0; i < n; i++) { s.mine.push(false); s.open.push(false); s.flag.push(false); s.trap.push(null); }
    return s;
  }
  function save() { return S.putMany('meta', [st]); }

  /* ---------- 판 ---------- */
  function nb(i) {
    var c = L().cols, r = L().rows, x = i % c, y = Math.floor(i / c), out = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) { continue; }
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < c && ny >= 0 && ny < r) { out.push(ny * c + nx); }
      }
    }
    return out;
  }
  function count(i) { return nb(i).filter(function (j) { return st.mine[j]; }).length; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function place(first) {
    var ban = {}, cells = [];
    ban[first] = true;
    nb(first).forEach(function (j) { ban[j] = true; });
    for (var i = 0; i < st.mine.length; i++) { if (!ban[i]) { cells.push(i); } }
    shuffle(cells);
    var order = PHD.quiz.pick(L().mines);
    cells.slice(0, L().mines).forEach(function (i, k) { st.mine[i] = true; st.trap[i] = order.length ? order[k % order.length].id : null; });
    st.started = true;
    st.t0 = Date.now();
  }
  function reveal(i) {
    var stack = [i];
    while (stack.length) {
      var k = stack.pop();
      if (st.open[k] || st.flag[k] || st.mine[k]) { continue; }
      st.open[k] = true;
      if (count(k) === 0) { nb(k).forEach(function (j) { if (!st.open[j]) { stack.push(j); } }); }
    }
  }
  function remaining() {
    var left = 0;
    st.mine.forEach(function (m, i) { if (m && !st.hit[i] && !st.flag[i]) { left += 1; } });
    st.flag.forEach(function (f, i) { if (f && !st.mine[i]) { left -= 1; } });
    return left;
  }

  /* ---------- 동작 ---------- */
  function tap(i) {
    i = Number(i);
    if (suppress) { suppress = false; return; }
    if (!st || st.over || pending) { return; }
    if (mode === 'flag') { flag(i); return; }
    if (st.open[i] || st.hit[i]) { chord(i); return; }
    if (st.flag[i]) { return; }
    if (!st.started) { place(i); }
    if (st.mine[i]) { hitMine(i); return; }
    reveal(i);
    G.sfx('flip', sound());
    after();
  }
  function chord(i) {
    if (st.mine[i] || !st.open[i]) { return; }
    var n = count(i);
    if (!n) { return; }
    var around = nb(i);
    var marked = around.filter(function (j) { return st.flag[j] || st.hit[j]; }).length;
    if (marked !== n) { return; }
    var boom = -1;
    around.forEach(function (j) {
      if (st.open[j] || st.flag[j] || st.hit[j]) { return; }
      if (st.mine[j]) { if (boom < 0) { boom = j; } } else { reveal(j); }
    });
    G.sfx('flip', sound());
    if (boom >= 0) { paint(); hitMine(boom); return; }
    after();
  }
  function flag(i) {
    i = Number(i);
    if (!st || st.over || st.open[i] || st.hit[i]) { return; }
    st.flag[i] = !st.flag[i];
    G.sfx('flip', sound());
    G.haptic(10);
    paint();
    save();
  }
  function after() {
    var safeLeft = 0;
    st.mine.forEach(function (m, i) { if (!m && !st.open[i]) { safeLeft += 1; } });
    paint();
    save();
    if (!safeLeft) { win(); }
  }

  function hitMine(i) {
    var t = byTrap[st.trap[i]] || traps[0];
    st.flag[i] = false;
    var order = PHD.quiz.order(t);
    pending = { i: i, trap: t, order: order };
    G.sfx('again', sound());
    G.haptic(30);
    paint();
    PHD.quiz.ask(answer);
    A().openSheet(`<div class='grab'></div><div class='trap'><span class='trap-k'>🚨 오보 함정을 밟았어요</span>` + PHD.quiz.questionHtml(t, order) + `</div>`);
  }
  function answer(k) {
    if (!pending || pending.answered) { return; }
    pending.answered = true;
    var t = pending.trap, ok = Number(k) === (t.answer || 0);
    st.hit[pending.i] = ok ? 'ok' : 'bad';
    st.open[pending.i] = true;
    if (!ok) { st.hearts -= 1; }
    G.sfx(ok ? 'good' : 'again', sound());
    var day = today(), wasNew = false;
    PHD.quiz.record(t.id, ok).then(function (r) { wasNew = r.isNew; return G.loadDiscover(); }).then(function (d) {
      disc = d;
      return PHD.play.status();
    }).then(function (s2) {
      return ok ? G.addXp(day, 2, wasNew ? 'disc' : null, s2.q) : null;
    }).then(function (out) {
      var lost = st.hearts <= 0;
      if (lost) { lose(); }
      save();
      paint();
      var extra = ok ? '함정 해체' + (out ? ' +' + out.gained + ' XP' : '') : '❤️ −1';
      A().openSheet(`<div class='grab'></div>` + PHD.quiz.explainHtml(t, pending.order, Number(k), { extra: extra }) +
        `<p class='disc-xp'>${wasNew ? '카드가 취재 덱에 들어갔어요' : '이미 아는 오보 유형'}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='ms-continue'>${lost ? '결과 보기' : '계속'}</button></div>`);
    }).catch(function (e) { A().toast('저장하지 못했습니다: ' + (e && e.message ? e.message : e)); });
  }
  function cont() {
    var p = pending;
    pending = null;
    A().closeSheet();
    paint();
    if (st.over && !st.won) { setTimeout(loseSheet, 150); return; }
    if (p) { after(); }
  }
  function lose() {
    st.over = true;
    st.t1 = Date.now();
    st.mine.forEach(function (m, i) { if (m) { st.open[i] = true; } });
  }
  function boardTraps() {
    var seen = {}, out = [];
    st.trap.forEach(function (id) { if (id && !seen[id] && byTrap[id]) { seen[id] = true; out.push(byTrap[id]); } });
    return out;
  }
  function secs() { return Math.max(0, Math.round(((st.t1 || Date.now()) - (st.t0 || Date.now())) / 1000)); }
  function clock(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  function loseSheet() {
    A().openSheet(`<div class='grab'></div><div class='disc'><span class='disc-k grey'>오보 ${HEARTS}건 — 이번 기사는 내려갔어요</span><h2>다시 취재해 볼까요?</h2>` +
      `<p class='disc-def'>이 판의 함정: ${esc(boardTraps().map(function (t) { return t.title; }).join(' · '))}</p>` +
      `<div class='btn-row'><button type='button' class='btn' data-action='ms-new'>새 판</button></div></div>`);
  }
  function win() {
    st.over = true; st.won = true; st.t1 = Date.now();
    st.wins = (st.wins || 0) + 1;
    var sec = secs();
    var hits = Object.keys(st.hit), bad = hits.filter(function (k) { return st.hit[k] === 'bad'; }).length;
    var stars = !hits.length ? 3 : (!bad ? 2 : 1);
    var prevBest = st.best[st.level];
    var record = !prevBest || sec < prevBest;
    if (record) { st.best[st.level] = sec; }
    st.mine.forEach(function (m, i) { if (m && !st.hit[i]) { st.flag[i] = true; } });
    save();
    paint();
    var xp = L().xp + stars - 1;
    PHD.play.status().then(function (s2) { return G.addXp(today(), xp, null, s2.q); }).then(function (out) {
      G.sfx('level', sound());
      A().openSheet(`<div class='grab'></div><div class='disc'><span class='disc-k'>기사 승인! · ${esc(L().name)}</span>` +
        `<div class='ms-stars'>${[1, 2, 3].map(function (n) { return `<i class='${n <= stars ? 'on' : ''}'>★</i>`; }).join('')}</div>` +
        `<h2 class='num'>${clock(sec)}${record ? ' <small>최고 기록!</small>' : ''}</h2>` +
        `<p class='disc-def'>${!hits.length ? '함정을 하나도 밟지 않았어요.' : '밟은 함정 ' + hits.length + '개 · 해체 ' + (hits.length - bad) + '개'}</p>` +
        `<p class='disc-def'>이 판의 함정: ${esc(boardTraps().map(function (t) { return t.title; }).join(' · '))}</p>` +
        `<p class='disc-xp'>+${out.gained} XP${out.streakUp ? ' · 🔥 연속 ' + out.game.streak + '일' : ''}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='ms-new'>한 판 더</button></div></div>`);
    });
  }
  function newGame(level) {
    st = fresh(level || st.level, st);
    pending = null;
    A().closeSheet();
    return save().then(function () { A().refresh(); });
  }

  /* ---------- 그리기 ---------- */
  function face() { return !st.started ? '🙂' : (st.over ? (st.won ? '😎' : '😵') : (pending ? '😮' : '🙂')); }
  function cellHtml(i) {
    var cls = 'mc', inner = '';
    if (st.hit[i]) { cls += st.hit[i] === 'ok' ? ' ok' : ' bad'; inner = st.hit[i] === 'ok' ? '🛡️' : '💥'; }
    else if (st.open[i] && st.mine[i]) { cls += ' mine'; inner = '🚨'; }
    else if (st.open[i]) { var n = count(i); cls += ' op' + (n ? ' n' + n : ''); inner = n ? String(n) : ''; }
    else if (st.flag[i]) { cls += ' fl'; inner = '🚩'; }
    return `<button type='button' class='${cls}' data-action='ms-cell' data-i='${i}' aria-label='${i + 1}번 칸'>${inner}</button>`;
  }
  function hearts() { var o = ''; for (var k = 0; k < HEARTS; k++) { o += k < st.hearts ? '❤️' : '🖤'; } return o; }
  function paint() {
    var b = el('ms-board');
    if (b) { b.innerHTML = st.mine.map(function (m, i) { return cellHtml(i); }).join(''); }
    var h = el('ms-hearts'); if (h) { h.textContent = hearts(); }
    var f = el('ms-face'); if (f) { f.textContent = face(); }
    var r = el('ms-left'); if (r) { r.textContent = String(remaining()); }
    var t = el('ms-time'); if (t) { t.textContent = clock(st.started ? secs() : 0); }
  }
  function screen() {
    return load().then(function () {
      if (!traps.length) {
        return `<a class='back' href='#/evidence'>‹ 오보찾기</a><h1 class='large-title'>지뢰찾기</h1>` + A().emptyCard('함정 자료가 아직 없어요', '기본 콘텐츠를 받으면 시작할 수 있어요.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`);
      }
      var lv = L();
      var known = traps.filter(function (t) { return disc.tr[t.id]; }).length;
      var seg = `<div class='seg ms-level' role='group'>` + Object.keys(LEVELS).map(function (k) {
        return `<button type='button' data-action='ms-level' data-val='${k}' aria-pressed='${st.level === k ? 'true' : 'false'}'>${LEVELS[k].name}</button>`;
      }).join('') + `</div>`;
      var modeSeg = `<div class='seg wide ms-mode' role='group'><button type='button' data-action='ms-mode' data-val='open' aria-pressed='${mode === 'open' ? 'true' : 'false'}'>⛏️ 열기</button><button type='button' data-action='ms-mode' data-val='flag' aria-pressed='${mode === 'flag' ? 'true' : 'false'}'>🚩 깃발</button></div>`;
      return `<a class='back' href='#/evidence'>‹ 오보찾기</a><div class='al-top'><h1 class='large-title'>지뢰찾기</h1>${seg}</div>` +
        `<p class='g-goal'>함정 ${lv.mines}개를 피해 기사를 살리세요. 알게 된 오보 유형 <b class='num'>${known}</b>/${traps.length}</p>` +
        `<div class='ms-bar'><span class='ms-chip' title='남은 함정'>🚨 <b class='num' id='ms-left'>${remaining()}</b></span><span id='ms-hearts' class='ms-hearts'>${hearts()}</span>` +
        `<button type='button' class='ms-face' id='ms-face' data-action='ms-new' aria-label='새 판'>${face()}</button><span class='ms-chip'>⏱ <b class='num' id='ms-time'>${clock(st.started ? secs() : 0)}</b></span></div>` +
        `<div class='ms-board' id='ms-board' style='--cols:${lv.cols}'>${st.mine.map(function (m, i) { return cellHtml(i); }).join('')}</div>` +
        modeSeg +
        `<p class='footnote'>숫자 = 주변 8칸의 함정 수. 길게 누르거나 우클릭하면 깃발, 숫자 칸을 누르면 주변을 한꺼번에 엽니다. 함정을 밟으면 4지선다로 해체!</p>`;
    });
  }

  /* ---------- 입력: 길게 누르기·우클릭 = 깃발 ---------- */
  document.addEventListener('pointerdown', function (ev) {
    var c = ev.target && ev.target.closest ? ev.target.closest('.mc') : null;
    if (!c) { return; }
    var i = Number(c.getAttribute('data-i'));
    press = { i: i, t: setTimeout(function () { if (press && press.i === i) { press.done = true; flag(i); } }, 450) };
    var f = el('ms-face'); if (f && st && !st.over) { f.textContent = '😮'; }
  });
  function endPress() {
    if (!press) { return; }
    clearTimeout(press.t);
    if (press.done) { suppress = true; setTimeout(function () { suppress = false; }, 400); }
    press = null;
    var f = el('ms-face'); if (f && st) { f.textContent = face(); }
  }
  document.addEventListener('pointerup', endPress);
  document.addEventListener('pointercancel', endPress);
  document.addEventListener('contextmenu', function (ev) {
    var c = ev.target && ev.target.closest ? ev.target.closest('.mc') : null;
    if (!c) { return; }
    ev.preventDefault();
    suppress = false;
    flag(c.getAttribute('data-i'));
  });
  timer = setInterval(function () {
    var t = el('ms-time');
    if (t && st && st.started && !st.over) { t.textContent = clock(secs()); }
  }, 1000);

  PHD.mines = {
    answerTrap: function (k) { answer(k); },
    screen: screen, tap: tap, flag: flag, answer: answer, cont: cont, newGame: newGame,
    setMode: function (m) { mode = m === 'flag' ? 'flag' : 'open'; A().refresh(); },
    setLevel: function (lv) { if (LEVELS[lv]) { newGame(lv); } },
    state: function () { return st; }, LEVELS: LEVELS
  };
})();
