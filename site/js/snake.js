/* 진우주 기자 학교 — 오보찾기: 스네이크(D021). 위에 문항, 판에는 A·B·C·D 먹이. 정답 글자를 먹으면 길어지고 빨라진다.
   틀린 글자를 먹거나 벽·몸에 부딪히면 ❤️ −1(3개). 틀리면 잠깐 멈추고 해설을 보여 준다. 방향키·WASD·스와이프·방향 버튼. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, G = PHD.game;
  var esc = U.esc;
  var N = 13, HEARTS = 3;
  var COLORS = ['#0A84FF', '#FF9F0A', '#BF5AF2', '#30B0C7'];
  var st = null, loop = null, swipe = null;

  function A() { return PHD.app; }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function back() { return `<a class='back' href='#/evidence'>‹ 오보찾기</a>`; }
  function Q() { return PHD.quiz; }

  function fresh() { return { phase: 'ready', snake: [], dir: { x: 1, y: 0 }, next: { x: 1, y: 0 }, grow: 0, foods: [], item: null, order: [], score: 0, hearts: HEARTS, results: [], msg: '', xpText: '', wrongK: null }; }
  function resetSnake() {
    var c = Math.floor(N / 2);
    st.snake = [{ x: c, y: c }, { x: c - 1, y: c }, { x: c - 2, y: c }];
    st.dir = { x: 1, y: 0 }; st.next = { x: 1, y: 0 };
  }
  function occupied(x, y) {
    return st.snake.some(function (s) { return s.x === x && s.y === y; }) || st.foods.some(function (f) { return f.x === x && f.y === y; });
  }
  function placeFoods() {
    st.foods = [];
    var h = st.snake[0];
    st.order.forEach(function (k, i) {
      var tries = 0, x, y;
      do {
        x = Math.floor(Math.random() * N); y = Math.floor(Math.random() * N); tries += 1;
      } while (tries < 200 && (occupied(x, y) || (Math.abs(x - h.x) + Math.abs(y - h.y) < 3) || st.foods.some(function (f) { return Math.abs(f.x - x) + Math.abs(f.y - y) < 2; })));
      st.foods.push({ x: x, y: y, k: k, i: i });
    });
  }
  function newQuestion() {
    st.item = Q().pick(1)[0];
    st.order = Q().order(st.item);
    placeFoods();
  }
  function speed() { return Math.max(120, 300 - st.score * 12); }
  function run() { clearInterval(loop); loop = setInterval(tick, speed()); }
  function start() {
    Q().resetSession();
    st = fresh();
    resetSnake();
    newQuestion();
    st.phase = 'run';
    G.sfx('combo', sound());
    paint(true);
    run();
  }
  function tick() {
    if (!st || st.phase !== 'run') { return; }
    if (!el('sn-board')) { clearInterval(loop); st.phase = 'ready'; return; }
    st.dir = st.next;
    var h = st.snake[0], nh = { x: h.x + st.dir.x, y: h.y + st.dir.y };
    var crash = nh.x < 0 || nh.y < 0 || nh.x >= N || nh.y >= N || st.snake.slice(0, -1).some(function (s) { return s.x === nh.x && s.y === nh.y; });
    if (crash) { return hurt('쾅! 벽이나 몸에 부딪혔어요'); }
    st.snake.unshift(nh);
    var food = st.foods.filter(function (f) { return f.x === nh.x && f.y === nh.y; })[0];
    if (food) { return eat(food); }
    if (st.grow > 0) { st.grow -= 1; } else { st.snake.pop(); }
    paintBoard();
  }
  function eat(food) {
    var ok = food.k === st.item.answer;
    st.results.push({ id: st.item.id, ok: ok });
    if (ok) {
      st.score += 1; st.grow += 2;
      G.sfx(st.score % 5 === 0 ? 'combo' : 'good', sound());
      st.msg = '✓ 정답! ' + st.item.title;
      newQuestion();
      run();
      paint(true);
      return;
    }
    st.hearts -= 1;
    G.sfx('again', sound()); G.haptic(25);
    st.wrongK = food.k;
    if (st.hearts <= 0) { return end(); }
    st.phase = 'explain';
    clearInterval(loop);
    paint(true);
  }
  function hurt(msg) {
    st.hearts -= 1;
    G.sfx('again', sound()); G.haptic(30);
    if (st.hearts <= 0) { return end(); }
    st.msg = msg + ' · ❤️ −1';
    resetSnake();
    placeFoods();
    paint(true);
  }
  function cont() {
    if (!st || st.phase !== 'explain') { return; }
    st.phase = 'run';
    st.wrongK = null;
    st.msg = '';
    newQuestion();
    paint(true);
    run();
  }
  function end() {
    st.phase = 'over';
    clearInterval(loop);
    paint(true);
    Q().recordMany(st.results).then(function (news) {
      return Q().setBest('snake', st.score).then(function (better) {
        return Q().award(st.score + 2 + (better ? 3 : 0), news).then(function (out) {
          st.xpText = '+' + out.gained + ' XP' + (news ? ' · 새 오보 유형 ' + news + '개' : '') + (better ? ' · 최고 기록!' : '');
          G.sfx(better ? 'level' : 'done', sound());
          paint(true);
        });
      });
    });
  }
  function turn(d) {
    if (!st || st.phase !== 'run') { return; }
    var m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d];
    if (!m || (m.x === -st.dir.x && m.y === -st.dir.y)) { return; }
    st.next = m;
  }

  /* ---------- 그리기 ---------- */
  function pos(p) { return `left:${(100 * p.x / N).toFixed(3)}%;top:${(100 * p.y / N).toFixed(3)}%;width:${(100 / N).toFixed(3)}%;height:${(100 / N).toFixed(3)}%`; }
  function boardInner() {
    var o = st.foods.map(function (f) { return `<i class='sn-food' style='${pos(f)};background:${COLORS[f.i]}'>${Q().LETTERS[f.i]}</i>`; }).join('');
    o += st.snake.map(function (s, i) { return `<i class='sn-seg${i === 0 ? ' head' : ''}' style='${pos(s)}'></i>`; }).join('');
    return o;
  }
  function paintBoard() { var b = el('sn-board'); if (b) { b.innerHTML = boardInner(); } }
  function hearts() { var o = ''; for (var k = 0; k < HEARTS; k++) { o += k < st.hearts ? '❤️' : '🖤'; } return o; }
  function questionHtml() {
    var it = st.item;
    return `<div class='sn-q'><p>${esc(it.headline)}</p><ol>${st.order.map(function (k, i) {
      return `<li><b style='background:${COLORS[i]}'>${Q().LETTERS[i]}</b><span>${esc(it.choices[k].t)}</span></li>`;
    }).join('')}</ol></div>`;
  }
  function body() {
    if (st.phase === 'ready') {
      var best = Q().state().best.snake;
      return `<div class='card ru-intro'><i>🐍</i><h2>스네이크</h2><p>위 문제의 정답 글자(A~D)를 먹으세요.<br>맞히면 길어지고 빨라집니다. ❤️ 3개.</p>` +
        `<p class='note'>방향키·WASD·스와이프·방향 버튼${best != null ? ' · 최고 ' + best + '점' : ''}</p><button type='button' class='play-btn' data-action='sn-start'>시작<span>Enter</span></button></div>`;
    }
    if (st.phase === 'over') {
      var list = st.results.map(function (r) { var it = Q().item(r.id); return `<button type='button' class='row' data-action='note-open' data-id='${esc(r.id)}'><div class='tx'>${r.ok ? '✓' : '✕'} ${esc(it.title)}<span class='sub'>${esc(it.headline)}</span></div><span class='chev'>›</span></button>`; }).join('');
      return `<div class='card sh-end'><span class='disc-k'>게임 끝</span><h2 class='num'>${st.score}점</h2><p class='disc-xp'>${esc(st.xpText)}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='sn-start'>한 판 더</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
        (list ? `<div class='section-title'>이번 판 문항 — 눌러서 해설</div><div class='list'>${list}</div>` : '');
    }
    var it = st.item, ex = '';
    if (st.phase === 'explain') {
      var ri = st.order.indexOf(it.answer), wi = st.order.indexOf(st.wrongK);
      ex = `<div class='sn-ex'><span class='trap-k bad'>✕ ${Q().LETTERS[wi]}는 오답 · ❤️ −1</span><p><b>정답 ${Q().LETTERS[ri]}</b> ${esc(it.choices[it.answer].t)}</p><p class='note'>${esc(it.choices[it.answer].why)}</p>` +
        `<div class='btn-row'><button type='button' class='btn secondary' data-action='note-open' data-id='${esc(it.id)}'>해설 전체</button><button type='button' class='btn' data-action='sn-cont'>계속</button></div></div>`;
    }
    return `<div class='ru-top'><span class='ms-chip'>🐍 <b class='num'>${st.score}</b></span><span class='ms-hearts'>${hearts()}</span><span class='ms-chip sn-msg'>${esc(st.msg || '정답 글자를 먹어요')}</span></div>` +
      questionHtml() + `<div class='sn-wrap'><div class='sn-board' id='sn-board'>${boardInner()}</div>${ex}</div>` +
      `<div class='sn-pad'><button type='button' data-action='sn-dir' data-val='up' aria-label='위'>▲</button><button type='button' data-action='sn-dir' data-val='left' aria-label='왼쪽'>◀</button><button type='button' data-action='sn-dir' data-val='down' aria-label='아래'>▼</button><button type='button' data-action='sn-dir' data-val='right' aria-label='오른쪽'>▶</button></div>`;
  }
  function paint() { var b = el('sn-body'); if (b) { b.innerHTML = body(); } }
  function screen() {
    return Q().load().then(function (bank) {
      if (!bank.length) { return back() + A().emptyCard('문항이 없어요', '기본 콘텐츠를 받아 주세요.', ''); }
      clearInterval(loop);
      if (!st || st.phase !== 'over') { st = fresh(); }
      return back() + `<h1 class='large-title'>스네이크</h1><div id='sn-body' class='sn'>${body()}</div>`;
    });
  }

  /* ---------- 입력 ---------- */
  var KEYS = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', function (ev) {
    if (!el('sn-body') || !st || ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
    var sheet = document.getElementById('sheet');
    if (sheet && !sheet.hidden) { return; }
    var k = String(ev.key || '').toLowerCase(), used = true;
    if (KEYS[k] && st.phase === 'run') { turn(KEYS[k]); }
    else if (k === 'enter' && st.phase === 'explain') { cont(); }
    else if (k === 'enter' && (st.phase === 'ready' || st.phase === 'over') && (!ev.target || ev.target.tagName !== 'BUTTON')) { start(); }
    else { used = false; }
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('pointerdown', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('#sn-board')) { swipe = { x: ev.clientX, y: ev.clientY }; }
  });
  document.addEventListener('pointerup', function (ev) {
    if (!swipe) { return; }
    var dx = ev.clientX - swipe.x, dy = ev.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { return; }
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  document.addEventListener('touchmove', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('#sn-board')) { ev.preventDefault(); }
  }, { passive: false });

  PHD.snake = {
    screen: screen, start: start, turn: turn, cont: cont, state: function () { return st; },
    _eat: function (i) { var f = st && st.foods.filter(function (x) { return x.i === i; })[0]; if (f) { eat(f); } },
    _tick: tick, _stop: function () { clearInterval(loop); }
  };
})();
