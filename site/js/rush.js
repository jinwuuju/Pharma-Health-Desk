/* 진우주 기자 학교 — 오락실: 속보 러시(D021, Puzzle Rush형). 90초 안에 문장마다 ‘정확’(→) 또는 ‘오보’(←).
   세 번 틀리면 끝. 문장은 문제 은행의 오보 문장·고쳐 쓴 문장·추가 O/X에서 반반으로. 끝나면 오답 노트. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, G = PHD.game;
  var esc = U.esc;
  var DUR = 90, STRIKES = 3;
  var st = null, timer = null, drag = null;

  function A() { return PHD.app; }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function back() { return `<a class='back' href='#/evidence'>‹ 오락실</a>`; }

  function fresh() { return { phase: 'ready', queue: [], cur: null, score: 0, streak: 0, bestStreak: 0, strikes: 0, t0: 0, left: DUR, answered: [], wrong: [], xpText: '' }; }
  function refill() { st.queue = st.queue.concat(PHD.quiz.statements(20)); }
  function next() {
    if (st.queue.length < 3) { refill(); }
    st.cur = st.queue.shift();
  }
  function start() {
    PHD.quiz.resetSession();
    st = fresh();
    st.phase = 'run';
    st.t0 = Date.now();
    refill();
    next();
    G.sfx('combo', sound());
    clearInterval(timer);
    timer = setInterval(tick, 100);
    paint();
  }
  function tick() {
    if (!st || st.phase !== 'run') { clearInterval(timer); return; }
    if (!el('ru-body')) { clearInterval(timer); st.phase = 'ready'; return; }
    st.left = Math.max(0, DUR - (Date.now() - st.t0) / 1000);
    var b = el('ru-time'); if (b) { b.style.width = (100 * st.left / DUR) + '%'; b.className = st.left < 15 ? 'low' : ''; }
    var t = el('ru-sec'); if (t) { t.textContent = String(Math.ceil(st.left)); }
    if (st.left <= 0) { end(); }
  }
  function answer(sayTrue) {
    if (!st || st.phase !== 'run' || !st.cur) { return; }
    var c = st.cur, ok = c.a === sayTrue;
    st.answered.push({ id: c.id, ok: ok });
    if (ok) {
      st.score += 1; st.streak += 1; st.bestStreak = Math.max(st.bestStreak, st.streak);
      G.sfx(st.streak % 5 === 0 ? 'combo' : 'good', sound());
    } else {
      st.strikes += 1; st.streak = 0; st.wrong.push(c);
      G.sfx('again', sound()); G.haptic(20);
    }
    flash(ok, c);
    if (st.strikes >= STRIKES) { end(); return; }
    next();
    paint();
  }
  function flash(ok, c) {
    var f = el('ru-flash');
    if (!f) { return; }
    f.className = 'ru-flash ' + (ok ? 'ok' : 'bad');
    f.textContent = ok ? '✓ ' + (c.a ? '정확' : '오보') : '✕ 정답은 ' + (c.a ? '정확' : '오보');
    void f.offsetWidth;
    f.classList.add('show');
  }
  function end() {
    if (!st || st.phase === 'over') { return; }
    st.phase = 'over';
    clearInterval(timer);
    paint();
    var Q = PHD.quiz;
    Q.recordMany(st.answered).then(function (news) {
      return Q.setBest('rush', st.score).then(function (better) {
        return Q.award(Math.ceil(st.score / 2) + (better ? 3 : 0), news).then(function (out) {
          st.xpText = '+' + out.gained + ' XP' + (news ? ' · 새 오보 유형 ' + news + '개' : '') + (better ? ' · 최고 기록!' : '');
          G.sfx(better ? 'level' : 'done', sound());
          paint();
        });
      });
    });
  }

  function body() {
    if (st.phase === 'ready') {
      var best = PHD.quiz.state().best.rush;
      return `<div class='card ru-intro'><i>⚡</i><h2>속보 러시</h2><p>문장이 쏟아집니다. 정확하면 오른쪽, 오보면 왼쪽.<br>90초, 세 번 틀리면 끝.</p>` +
        `<p class='note'>키보드 ← 오보 · → 정확${best != null ? ' · 최고 ' + best + '점' : ''}</p>` +
        `<button type='button' class='play-btn' data-action='ru-start'>시작<span>Enter</span></button></div>`;
    }
    if (st.phase === 'over') {
      var acc = st.answered.length ? Math.round(100 * st.score / st.answered.length) : 0;
      return `<div class='card sh-end'><span class='disc-k'>${st.strikes >= STRIKES ? '스트라이크 아웃' : '시간 종료'}</span><h2 class='num'>${st.score}점</h2>` +
        `<p class='disc-def'>정확도 ${acc}% · 최고 연속 ${st.bestStreak}</p><p class='disc-xp'>${esc(st.xpText)}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='ru-start'>한 판 더</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
        PHD.quiz.oxNoteHtml(st.wrong);
    }
    var strikes = '';
    for (var i = 0; i < STRIKES; i++) { strikes += `<i class='${i < st.strikes ? 'on' : ''}'>✕</i>`; }
    return `<div class='ru-top'><span class='ms-chip'>⚡ <b class='num'>${st.score}</b></span><span class='ru-strikes'>${strikes}</span><span class='ms-chip'>⏱ <b class='num' id='ru-sec'>${Math.ceil(st.left)}</b></span></div>` +
      `<div class='ru-bar'><i id='ru-time' style='width:${100 * st.left / DUR}%'></i></div>` +
      `<div class='ru-stage'><div class='ru-card' id='ru-card'><span class='ru-k'>이 문장, 정확할까?</span><p>${esc(st.cur.t)}</p>${st.streak >= 3 ? `<span class='ru-streak'>🔥 ${st.streak}연속</span>` : ''}</div><div class='ru-flash' id='ru-flash'></div></div>` +
      `<div class='ru-btns'><button type='button' class='ru-b x' data-action='ru-ans' data-val='x'>✕ 오보<kbd>←</kbd></button><button type='button' class='ru-b o' data-action='ru-ans' data-val='o'>✓ 정확<kbd>→</kbd></button></div>`;
  }
  function paint() { var b = el('ru-body'); if (b) { b.innerHTML = body(); } }
  function screen() {
    return PHD.quiz.load().then(function (bank) {
      if (!bank.length) { return back() + A().emptyCard('문항이 없어요', '기본 콘텐츠를 받아 주세요.', ''); }
      if (!st || st.phase === 'run') { if (st && st.phase === 'run') { clearInterval(timer); } st = fresh(); }
      return back() + `<h1 class='large-title'>속보 러시</h1><div id='ru-body' class='ru'>${body()}</div>`;
    });
  }

  /* ---------- 입력: 키·스와이프 ---------- */
  document.addEventListener('keydown', function (ev) {
    if (!el('ru-body') || !st || ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
    var sheet = document.getElementById('sheet');
    if (sheet && !sheet.hidden) { return; }
    var used = true;
    if (st.phase === 'run' && ev.key === 'ArrowRight') { answer(true); }
    else if (st.phase === 'run' && ev.key === 'ArrowLeft') { answer(false); }
    else if (st.phase !== 'run' && ev.key === 'Enter' && (!ev.target || ev.target.tagName !== 'BUTTON')) { start(); }
    else { used = false; }
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('pointerdown', function (ev) {
    var c = ev.target && ev.target.closest ? ev.target.closest('#ru-card') : null;
    if (!c || !st || st.phase !== 'run') { return; }
    drag = { x: ev.clientX, el: c };
  });
  document.addEventListener('pointermove', function (ev) {
    if (!drag) { return; }
    var dx = ev.clientX - drag.x;
    drag.el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 20) + 'deg)';
    drag.el.classList.toggle('lean-o', dx > 40);
    drag.el.classList.toggle('lean-x', dx < -40);
  });
  document.addEventListener('pointerup', function (ev) {
    if (!drag) { return; }
    var dx = ev.clientX - drag.x, c = drag.el;
    drag = null;
    c.style.transform = '';
    c.classList.remove('lean-o', 'lean-x');
    if (Math.abs(dx) > 70) { answer(dx > 0); }
  });

  PHD.rush = { screen: screen, start: start, answer: answer, state: function () { return st; } };
})();
