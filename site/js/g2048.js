/* 진우주 기자 학교 — 근거 2048(2048형, D019). 같은 근거 두 개를 합치면 한 단계 위 근거가 된다:
   일화 → 세포·동물 실험 → 전문가 의견 → 사례 보고 → 단면 연구 → 환자-대조군 → 코호트 → RCT → 메타분석 → 진료지침.
   처음 닿은 단계마다 카드가 열린다. 방향키·스와이프. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, G = PHD.game;
  var esc = U.esc;
  var N = 4, MAX = 10, GOAL = 9;
  var st = null, levels = null, anim = { merged: {}, born: -1 }, touch = null, busy = false;

  function A() { return PHD.app; }
  function today() { return U.studyDate(A().settings().dayStartHour); }
  function el(id) { return document.getElementById(id); }

  function load() {
    return Promise.all([S.get('meta', 'g2048'), S.getAll('content', 'kind', 'evidence'), G.loadDiscover()]).then(function (res) {
      levels = {};
      res[1].forEach(function (r) { levels[r.data.level] = r.data; });
      st = res[0] && Array.isArray(res[0].board) && res[0].board.length === N * N ? res[0] : fresh(res[0]);
      st.reached = res[2].ev || {};
      return st;
    });
  }
  function fresh(prev) {
    var s = { key: 'g2048', board: [], score: 0, best: (prev && prev.best) || 0, over: false, moves: 0, games: ((prev && prev.games) || 0) + 1 };
    for (var i = 0; i < N * N; i++) { s.board.push(0); }
    spawn(s); spawn(s);
    return s;
  }
  function save() { var copy = {}; Object.keys(st).forEach(function (k) { if (k !== 'reached') { copy[k] = st[k]; } }); return S.putMany('meta', [copy]); }
  function spawn(s) {
    var empty = [];
    s.board.forEach(function (v, i) { if (!v) { empty.push(i); } });
    if (!empty.length) { return -1; }
    var i = empty[Math.floor(Math.random() * empty.length)];
    s.board[i] = Math.random() < 0.9 ? 1 : 2;
    return i;
  }
  function lv(n) { return (levels && levels[n]) || { name: String(Math.pow(2, n)), icon: '', level: n }; }

  /* ---------- 이동 ---------- */
  function lineIdx(dir, k) {
    var out = [];
    for (var j = 0; j < N; j++) {
      if (dir === 'left') { out.push(k * N + j); }
      if (dir === 'right') { out.push(k * N + (N - 1 - j)); }
      if (dir === 'up') { out.push(j * N + k); }
      if (dir === 'down') { out.push((N - 1 - j) * N + k); }
    }
    return out;
  }
  function slide(dir) {
    var b = st.board, moved = false, gained = 0, merged = {}, top = 0;
    for (var k = 0; k < N; k++) {
      var idx = lineIdx(dir, k);
      var vals = idx.map(function (i) { return b[i]; }).filter(function (v) { return v; });
      var out = [];
      for (var x = 0; x < vals.length; x++) {
        if (x + 1 < vals.length && vals[x] === vals[x + 1] && vals[x] < MAX) {
          var nv = vals[x] + 1;
          out.push(nv);
          gained += Math.pow(2, nv);
          merged[idx[out.length - 1]] = true;
          top = Math.max(top, nv);
          x += 1;
        } else { out.push(vals[x]); }
      }
      while (out.length < N) { out.push(0); }
      idx.forEach(function (i, j) { if (b[i] !== out[j]) { moved = true; } b[i] = out[j]; });
    }
    return { moved: moved, gained: gained, merged: merged, top: top };
  }
  function canMove() {
    var b = st.board;
    for (var i = 0; i < N * N; i++) {
      if (!b[i]) { return true; }
      var r = Math.floor(i / N), c = i % N;
      if (c < N - 1 && b[i] === b[i + 1] && b[i] < MAX) { return true; }
      if (r < N - 1 && b[i] === b[i + N] && b[i] < MAX) { return true; }
    }
    return false;
  }

  function move(dir) {
    if (!st || st.over || busy) { return; }
    var r = slide(dir);
    if (!r.moved) { return; }
    var sound = A().settings().sound !== false;
    st.score += r.gained;
    st.best = Math.max(st.best || 0, st.score);
    st.moves = (st.moves || 0) + 1;
    anim.merged = r.merged;
    anim.born = spawn(st);
    if (r.gained) { G.sfx('flip', sound); }
    if (!canMove()) { st.over = true; }
    paint();
    var newTop = 0;
    st.board.forEach(function (v) { if (v > newTop) { newTop = v; } });
    var first = [];
    for (var n = 1; n <= newTop; n++) { if (!st.reached['HB-EV-' + (n < 10 ? '0' : '') + n]) { first.push(n); } }
    save();
    if (first.length) { reach(first); }
    else if (st.over) { setTimeout(gameOver, 300); }
  }

  function reach(list) {
    busy = true;
    var n = list[list.length - 1];
    var chain = Promise.resolve();
    list.forEach(function (k) {
      chain = chain.then(function () { return G.discover('ev', 'HB-EV-' + (k < 10 ? '0' : '') + k); }).then(function (res) { st.reached = res.all.ev; });
    });
    chain.then(function () { return PHD.play.status(); }).then(function (s) {
      return G.addXp(today(), G.XP.fresh * list.length, 'disc', s.q);
    }).then(function (out) {
      busy = false;
      G.sfx('level', A().settings().sound !== false);
      paintLadder();
      var L = lv(n);
      A().openSheet(`<div class='grab'></div><div class='disc'><span class='disc-k'>근거 사다리 ${n}단계${n >= GOAL ? ' · 정점 도달!' : ''}</span>` +
        `<div class='disc-ic'><i class='ic big'>${esc(L.icon || '')}</i></div><h2>${esc(L.name)}</h2><p class='disc-def'>${esc(L.def || '')}</p>` +
        (L.note ? `<p class='disc-note'><b>기자 포인트</b> ${esc(L.note)}</p>` : '') +
        `<p class='disc-xp'>+${out.gained} XP · 카드가 취재 덱에 들어갔어요${out.streakUp ? ' · 🔥 연속 ' + out.game.streak + '일' : ''}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='g-continue'>계속</button></div></div>`);
    }).catch(function () { busy = false; });
  }

  function gameOver() {
    A().openSheet(`<div class='grab'></div><div class='disc'><span class='disc-k'>더 합칠 수 없어요</span><h2>점수 <span class='num'>${st.score}</span></h2>` +
      `<p class='disc-def'>최고 기록 ${st.best} · 이번 판 최고 근거: ${esc(lv(Math.max.apply(null, st.board)).name)}</p>` +
      `<div class='btn-row'><button type='button' class='btn' data-action='g-new'>새 판</button></div></div>`);
  }

  /* ---------- 그리기 ---------- */
  function tile(v, i) {
    if (!v) { return `<div class='cell'></div>`; }
    var L = lv(v);
    var cls = 't l' + v + (anim.merged[i] ? ' merged' : '') + (anim.born === i ? ' born' : '');
    return `<div class='cell'><div class='${cls}'><i>${esc(L.icon || '')}</i><b>${esc(L.name)}</b></div></div>`;
  }
  function boardHtml() { return st.board.map(tile).join(''); }
  function ladderHtml() {
    var o = '';
    for (var n = 1; n <= MAX; n++) {
      var on = !!st.reached['HB-EV-' + (n < 10 ? '0' : '') + n];
      o += `<button type='button' class='rung${on ? ' on' : ''} l${n}' data-action='g-level' data-n='${n}' title='${esc(on ? lv(n).name : '?')}'>${on ? esc(lv(n).icon || n) : n}</button>`;
    }
    return o;
  }
  function paint() {
    var b = el('g-board'); if (b) { b.innerHTML = boardHtml(); }
    var s = el('g-score'); if (s) { s.textContent = String(st.score); }
    var t = el('g-best'); if (t) { t.textContent = String(st.best); }
  }
  function paintLadder() { var l = el('g-ladder'); if (l) { l.innerHTML = ladderHtml(); } }

  function screen() {
    return load().then(function () {
      if (!Object.keys(levels).length) {
        return `<h1 class='large-title'>근거 2048</h1>` + A().emptyCard('근거 사다리가 아직 없어요', '기본 콘텐츠를 받으면 시작할 수 있어요.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`);
      }
      anim = { merged: {}, born: -1 };
      var reached = Object.keys(st.reached).length;
      return `<div class='g-top'><h1 class='large-title'>근거 2048</h1><div class='g-scores'><div><span>점수</span><b class='num' id='g-score'>${st.score}</b></div><div><span>최고</span><b class='num' id='g-best'>${st.best}</b></div></div></div>` +
        `<p class='g-goal'>같은 근거를 합쳐 <b>메타분석</b>까지. 사다리 <b class='num'>${reached}</b>/${MAX}</p>` +
        `<div class='ladder' id='g-ladder'>${ladderHtml()}</div>` +
        `<div class='board' id='g-board' tabindex='0' aria-label='근거 2048 판. 방향키나 스와이프로 움직입니다.'>${boardHtml()}</div>` +
        `<div class='g-foot'><span>방향키 · 스와이프</span><button type='button' class='link-btn' data-action='g-new'>새 판</button></div>`;
    });
  }
  function levelInfo(n) {
    n = Number(n);
    var on = st && st.reached['HB-EV-' + (n < 10 ? '0' : '') + n];
    var L = lv(n);
    A().openSheet(`<div class='grab'></div><div class='disc'><span class='disc-k'>근거 사다리 ${n}단계</span>` +
      (on ? `<div class='disc-ic'><i class='ic big'>${esc(L.icon || '')}</i></div><h2>${esc(L.name)}</h2><p class='disc-def'>${esc(L.def || '')}</p>${L.note ? `<p class='disc-note'><b>기자 포인트</b> ${esc(L.note)}</p>` : ''}`
        : `<div class='disc-ic'><i class='ic big q'>?</i></div><h2>아직 닿지 못한 단계</h2><p class='disc-def'>판에서 ${n}단계 근거를 만들면 열립니다.</p>`) +
      `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>닫기</button></div></div>`);
  }
  function newGame() {
    st = fresh(st);
    return Promise.all([save(), G.loadDiscover()]).then(function (r) { st.reached = r[1].ev || {}; A().closeSheet(); A().refresh(); });
  }

  /* ---------- 입력 ---------- */
  var KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  document.addEventListener('keydown', function (ev) {
    if (!KEYS[ev.key] || !el('g-board')) { return; }
    var sheet = document.getElementById('sheet');
    if (sheet && !sheet.hidden) { return; }
    if (PHD.play && PHD.play.active()) { return; }
    ev.preventDefault();
    move(KEYS[ev.key]);
  });
  document.addEventListener('pointerdown', function (ev) {
    if (!ev.target || !ev.target.closest || !ev.target.closest('#g-board')) { return; }
    touch = { x: ev.clientX, y: ev.clientY };
  });
  document.addEventListener('pointerup', function (ev) {
    if (!touch) { return; }
    var dx = ev.clientX - touch.x, dy = ev.clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { return; }
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  document.addEventListener('touchmove', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('#g-board')) { ev.preventDefault(); }
  }, { passive: false });

  PHD.g2048 = {
    screen: screen, move: move, newGame: newGame, levelInfo: levelInfo,
    after: function () { A().closeSheet(); if (st && st.over) { setTimeout(gameOver, 200); } },
    state: function () { return st; }
  };
})();
