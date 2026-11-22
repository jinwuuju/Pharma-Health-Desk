/* 진우주 기자 학교 — 오락실: 타자 게임(산성비형, D022). 뜻풀이가 위에서 떨어진다. 정확한 용어를 쳐서 터뜨린다.
   바닥에 닿으면 ❤️ −1(3개)과 함께 정답을 보여 준다. 5개마다 레벨이 오르고 빨라진다. 용어 38개(치명률·%p·비열등성·계약금…). */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, G = PHD.game;
  var esc = U.esc;
  var LIVES = 3, MAXDROP = 4, STEP = 50;
  var terms = [], st = null, loop = null, uid = 0;

  function A() { return PHD.app; }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function back() { return `<a class='back' href='#/evidence'>‹ 오락실</a>`; }
  function norm(s) { return String(s || '').toLowerCase().split(' ').join('').split('-').join('').split('·').join('').split('(').join('').split(')').join(''); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function load() {
    return Promise.all([S.getAll('content', 'kind', 'typeterm'), G.loadDiscover()]).then(function (res) {
      terms = res[0].map(function (r) { return r.data; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var d = res[1];
      return { terms: terms, disc: d };
    });
  }
  function fresh() { return { phase: 'ready', drops: [], queue: [], score: 0, lives: LIVES, level: 1, hits: [], missed: [], since: 0, lastMiss: null, xpText: '' }; }
  function interval() { return Math.max(1400, 3400 - (st.level - 1) * 280); }
  function speed() { return 5.5 + (st.level - 1) * 0.9; }   // 판 높이 % / 초
  function spawn() {
    if (!st.queue.length) { st.queue = shuffle(terms); }
    var active = {};
    st.drops.forEach(function (d) { active[d.term.id] = true; });
    var t = st.queue.shift();
    if (active[t.id]) { st.queue.push(t); return; }
    st.drops.push({ uid: ++uid, term: t, x: 4 + Math.random() * 52, y: -8 });
    st.since = 0;
  }
  function start() {
    st = fresh();
    st.phase = 'run';
    st.queue = shuffle(terms);
    spawn();
    paint();
    var inp = el('ty-in'); if (inp) { inp.focus(); }
    G.sfx('combo', sound());
    clearInterval(loop);
    loop = setInterval(function () { step(STEP); }, STEP);
  }
  function step(dt) {
    if (!st || st.phase !== 'run') { return; }
    if (!el('ty-field')) { clearInterval(loop); st.phase = 'ready'; return; }
    st.since += dt;
    var v = speed() * dt / 1000, landed = [];
    st.drops.forEach(function (d) { d.y += v; if (d.y >= 92) { landed.push(d); } });
    landed.forEach(function (d) {
      st.drops = st.drops.filter(function (x) { return x !== d; });
      st.lives -= 1;
      st.missed.push(d.term);
      st.lastMiss = d.term;
      G.sfx('again', sound()); G.haptic(20);
    });
    if (st.lives <= 0) { return end(); }
    if ((st.since >= interval() && st.drops.length < MAXDROP) || !st.drops.length) { spawn(); }
    paintField();
  }
  function match(text) {
    var v = norm(text);
    if (!v) { return false; }
    var d = st.drops.filter(function (x) { return [x.term.answer].concat(x.term.alts || []).some(function (a) { return norm(a) === v; }); })
      .sort(function (a, b) { return b.y - a.y; })[0];
    if (!d) { return false; }
    st.drops = st.drops.filter(function (x) { return x !== d; });
    st.hits.push(d.term);
    st.score += 10 * st.level;
    st.level = 1 + Math.floor(st.hits.length / 5);
    G.sfx(st.hits.length % 5 === 0 ? 'combo' : 'good', sound());
    pop(d);
    if (!st.drops.length) { spawn(); }
    paintHud();
    paintField();
    return true;
  }
  function onInput(inp) {
    if (!st || st.phase !== 'run') { return; }
    if (match(inp.value)) { inp.value = ''; setTimeout(function () { if (el('ty-in') && match(el('ty-in').value) === false && norm(el('ty-in').value).length <= 1) { el('ty-in').value = ''; } }, 0); }
  }
  function submit() {
    var inp = el('ty-in');
    if (!inp || !st || st.phase !== 'run') { return; }
    if (match(inp.value)) { inp.value = ''; return; }
    inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake');
    G.sfx('flip', sound());
  }
  function pop(d) {
    var f = el('ty-field');
    if (!f) { return; }
    var p = document.createElement('div');
    p.className = 'ty-pop';
    p.style.left = d.x + '%'; p.style.top = d.y + '%';
    p.textContent = '+' + (10 * st.level) + ' ' + d.term.answer;
    f.appendChild(p);
    setTimeout(function () { if (p.parentNode) { p.parentNode.removeChild(p); } }, 900);
  }
  function end() {
    st.phase = 'over';
    clearInterval(loop);
    paint();
    var seen = {};
    st.hits.concat(st.missed).forEach(function (t) { seen[t.id] = true; });
    var news = 0;
    Object.keys(seen).reduce(function (p, id) { return p.then(function () { return G.discover('ty', id).then(function (r) { if (r.isNew) { news += 1; } }); }); }, Promise.resolve()).then(function () {
      return PHD.quiz.setBest('typing', st.score);
    }).then(function (better) {
      return PHD.quiz.award(st.hits.length + 2 + (better ? 3 : 0), news).then(function (out) {
        st.xpText = '+' + out.gained + ' XP' + (news ? ' · 새 용어 ' + news + '개' : '') + (better ? ' · 최고 기록!' : '');
        G.sfx(better ? 'level' : 'done', sound());
        paint();
      });
    });
  }

  function hearts() { var o = ''; for (var k = 0; k < LIVES; k++) { o += k < st.lives ? '❤️' : '🖤'; } return o; }
  function paintHud() {
    var s = el('ty-score'); if (s) { s.textContent = String(st.score); }
    var l = el('ty-level'); if (l) { l.textContent = String(st.level); }
    var h = el('ty-hearts'); if (h) { h.textContent = hearts(); }
    var m = el('ty-miss'); if (m) { m.innerHTML = st.lastMiss ? `놓침: <b>${esc(st.lastMiss.answer)}</b> ← ${esc(st.lastMiss.cue)}` : '뜻풀이를 보고 용어를 치면 터져요'; }
  }
  function paintField() {
    var f = el('ty-field');
    if (!f) { return; }
    var keep = {};
    st.drops.forEach(function (d) {
      keep[d.uid] = true;
      var n = f.querySelector(`[data-uid='${d.uid}']`);
      if (!n) {
        n = document.createElement('div');
        n.className = 'ty-drop';
        n.setAttribute('data-uid', String(d.uid));
        n.textContent = d.term.cue;
        n.style.left = d.x + '%';
        f.appendChild(n);
      }
      n.style.top = d.y + '%';
      n.classList.toggle('low', d.y > 70);
    });
    Array.prototype.slice.call(f.querySelectorAll('.ty-drop')).forEach(function (n) { if (!keep[n.getAttribute('data-uid')]) { n.parentNode.removeChild(n); } });
    paintHud();
  }
  function body() {
    if (st.phase === 'ready') {
      var best = PHD.quiz.state() ? PHD.quiz.state().best.typing : null;
      return `<div class='card ru-intro'><i>⌨️</i><h2>타자 게임</h2><p>뜻풀이가 떨어집니다. <b>정확한 용어</b>를 치면 터져요.<br>바닥에 닿으면 ❤️ −1, 5개마다 빨라집니다.</p>` +
        `<p class='note'>예: ‘확진자 가운데 사망한 비율’ → 치명률${best != null ? ' · 최고 ' + best + '점' : ''}</p><button type='button' class='play-btn' data-action='ty-start'>시작<span>용어 ${terms.length}개</span></button></div>`;
    }
    if (st.phase === 'over') {
      var miss = {}, list = st.missed.filter(function (t) { if (miss[t.id]) { return false; } miss[t.id] = true; return true; });
      return `<div class='card sh-end'><span class='disc-k'>게임 끝</span><h2 class='num'>${st.score}점</h2><p class='disc-def'>터뜨린 용어 ${st.hits.length}개 · 레벨 ${st.level}</p><p class='disc-xp'>${esc(st.xpText)}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='ty-start'>한 판 더</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
        (list.length ? `<div class='section-title'>놓친 용어</div><div class='list'>` + list.map(function (t) { return `<div class='row'><div class='tx'><b>${esc(t.answer)}</b> — ${esc(t.cue)}<span class='sub'>${esc(t.why)}</span></div></div>`; }).join('') + `</div>` : '');
    }
    return `<div class='ru-top'><span class='ms-chip'>⌨️ <b class='num' id='ty-score'>${st.score}</b></span><span class='ms-hearts' id='ty-hearts'>${hearts()}</span><span class='ms-chip'>Lv <b class='num' id='ty-level'>${st.level}</b></span></div>` +
      `<div class='ty-field' id='ty-field'></div><p class='ty-miss' id='ty-miss'></p>` +
      `<div class='pz-input'><input id='ty-in' autocomplete='off' autocapitalize='off' spellcheck='false' placeholder='정확한 용어 입력' aria-label='용어 입력'><button type='button' class='btn' data-action='ty-submit'>↵</button></div>`;
  }
  function paint() {
    var b = el('ty-body');
    if (!b) { return; }
    b.innerHTML = body();
    if (st.phase === 'run') { paintField(); }
  }
  function screen() {
    return Promise.all([load(), PHD.quiz.load()]).then(function (res) {
      if (!res[0].terms.length) { return back() + A().emptyCard('용어가 없어요', '기본 콘텐츠를 받아 주세요.', ''); }
      clearInterval(loop);
      if (!st || st.phase === 'run') { st = fresh(); }
      return back() + `<h1 class='large-title'>타자 게임</h1><div id='ty-body' class='ty'>${body()}</div>`;
    });
  }
  document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'ty-in') { onInput(ev.target); } });
  document.addEventListener('compositionend', function (ev) { if (ev.target && ev.target.id === 'ty-in') { onInput(ev.target); } });
  document.addEventListener('keydown', function (ev) {
    if (ev.target && ev.target.id === 'ty-in' && ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); submit(); }
  });

  PHD.typing = { screen: screen, start: start, submit: submit, state: function () { return st; }, _step: step, _stop: function () { clearInterval(loop); }, norm: norm };
})();
