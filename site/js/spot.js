/* 진우주 기자 학교 — 오락실: 틀린 그림 찾기(교정지, D022). 오보 제목에서 ‘틀린 곳’을 탭한다.
   한 판 10문장, 문장마다 20초, ❤️ 3. 찾으면 빨간 동그라미와 고쳐 쓰기, 틀리게 짚으면 ❤️ −1. 데스크가 교정지를 보는 감각. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, G = PHD.game;
  var esc = U.esc;
  var ROUNDS = 10, HEARTS = 3, LIMIT = 20;
  var st = null, timer = null;

  function A() { return PHD.app; }
  function Q() { return PHD.quiz; }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function back() { return `<a class='back' href='#/evidence'>‹ 오락실</a>`; }

  function tokens(head, spot) {
    var s0 = head.indexOf(spot), s1 = s0 + spot.length, out = [], re = /[^ ]+/g, m;
    while ((m = re.exec(head))) {
      var a = m.index, b = a + m[0].length;
      out.push({ t: m[0], hit: s0 >= 0 && a < s1 && b > s0, dash: m[0] === '—' });
    }
    return out;
  }
  function fresh() { return { phase: 'ready', items: [], idx: 0, hearts: HEARTS, score: 0, found: 0, results: [], toks: [], miss: {}, wrongTaps: 0, t0: 0, left: LIMIT, xpText: '', timedOut: false }; }
  function start() {
    Q().resetSession();
    st = fresh();
    st.items = Q().pick(ROUNDS, { filter: function (x) { return !!x.spot; } });
    st.phase = 'run';
    round();
    G.sfx('combo', sound());
    clearInterval(timer);
    timer = setInterval(tick, 200);
  }
  function round() {
    var it = st.items[st.idx];
    st.toks = tokens(it.headline, it.spot);
    st.miss = {}; st.wrongTaps = 0; st.t0 = Date.now(); st.left = LIMIT; st.timedOut = false;
    st.phase = 'run';
    paint();
  }
  function tick() {
    if (!st || st.phase !== 'run') { return; }
    if (!el('sp-body')) { clearInterval(timer); st.phase = 'ready'; return; }
    st.left = Math.max(0, LIMIT - (Date.now() - st.t0) / 1000);
    var b = el('sp-time'); if (b) { b.style.width = (100 * st.left / LIMIT) + '%'; b.className = st.left < 6 ? 'low' : ''; }
    if (st.left <= 0) { timeout(); }
  }
  function timeout() {
    st.hearts -= 1; st.timedOut = true;
    G.sfx('again', sound());
    reveal(false);
  }
  function tap(i) {
    if (!st || st.phase !== 'run') { return; }
    var tk = st.toks[Number(i)];
    if (!tk || tk.dash) { return; }
    if (tk.hit) {
      var bonus = Math.round(st.left);
      st.score += 10 + bonus; st.found += 1;
      G.sfx(st.wrongTaps ? 'good' : 'easy', sound());
      reveal(true);
      return;
    }
    if (st.miss[i]) { return; }
    st.miss[i] = true; st.wrongTaps += 1; st.hearts -= 1;
    G.sfx('again', sound()); G.haptic(20);
    if (st.hearts <= 0) { reveal(false); return; }
    paint();
  }
  function reveal(ok) {
    st.phase = 'found';
    st.results.push({ id: st.items[st.idx].id, ok: ok && !st.wrongTaps });
    paint();
  }
  function next() {
    if (!st || st.phase !== 'found') { return; }
    if (st.hearts <= 0 || st.idx >= st.items.length - 1) { return end(); }
    st.idx += 1;
    round();
  }
  function end() {
    st.phase = 'over';
    clearInterval(timer);
    paint();
    Q().recordMany(st.results).then(function (news) {
      return Q().setBest('spot', st.score).then(function (better) {
        return Q().award(st.found + 2 + (better ? 3 : 0), news).then(function (out) {
          st.xpText = '+' + out.gained + ' XP' + (news ? ' · 새 오보 유형 ' + news + '개' : '') + (better ? ' · 최고 기록!' : '');
          G.sfx(better ? 'level' : 'done', sound());
          paint();
        });
      });
    });
  }

  function hearts() { var o = ''; for (var k = 0; k < HEARTS; k++) { o += k < st.hearts ? '❤️' : '🖤'; } return o; }
  function paperHtml(done) {
    var it = st.items[st.idx];
    return `<div class='paper${done ? ' done' : ''}'><span class='paper-k'>교정지 · ${esc(it.catName || '')} · 난도 ${'●●●'.slice(0, it.lv || 1)}</span><p class='paper-h'>` +
      st.toks.map(function (tk, i) {
        if (tk.dash) { return `<span class='pt dash'>—</span>`; }
        var cls = 'pt' + (done && tk.hit ? ' circled' : '') + (st.miss[i] ? ' miss' : '');
        return `<button type='button' class='${cls}' data-action='sp-tap' data-i='${i}'${done ? ' disabled' : ''}>${esc(tk.t)}</button>`;
      }).join(' ') + `</p></div>`;
  }
  function body() {
    if (st.phase === 'ready') {
      var best = Q().state().best.spot;
      return `<div class='card ru-intro'><i>🔍</i><h2>틀린 그림 찾기</h2><p>데스크의 교정지입니다. 오보 제목에서 <b>틀린 곳</b>을 탭하세요.<br>10문장, 문장마다 20초, ❤️ 3.</p>` +
        `<p class='note'>빨리 찾을수록 점수가 높아요${best != null ? ' · 최고 ' + best + '점' : ''}</p><button type='button' class='play-btn' data-action='sp-start'>교정 시작<span>Enter</span></button></div>`;
    }
    if (st.phase === 'over') {
      var list = st.results.map(function (r) { var it = Q().item(r.id); return `<button type='button' class='row' data-action='note-open' data-id='${esc(r.id)}'><div class='tx'>${r.ok ? '✓' : '✕'} ${esc(it.title)}<span class='sub'>${esc(it.headline)}</span></div><span class='chev'>›</span></button>`; }).join('');
      return `<div class='card sh-end'><span class='disc-k'>교정 끝</span><h2 class='num'>${st.score}점</h2><p class='disc-def'>${st.found}/${st.results.length}곳 찾음</p><p class='disc-xp'>${esc(st.xpText)}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='sp-start'>한 판 더</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
        `<div class='section-title'>이번 교정지 — 눌러서 해설</div><div class='list'>${list}</div>`;
    }
    var it = st.items[st.idx];
    var top = `<div class='ru-top'><span class='ms-chip'>🔍 <b class='num'>${st.score}</b></span><span class='ms-hearts'>${hearts()}</span><span class='ms-chip'><b class='num'>${st.idx + 1}</b>/${st.items.length}</span></div>` +
      `<div class='ru-bar'><i id='sp-time' style='width:${100 * st.left / LIMIT}%'></i></div>`;
    if (st.phase === 'run') {
      return top + paperHtml(false) + `<p class='sp-hint'>틀린 곳을 탭하세요 · 낱말 하나만 짚어도 돼요</p>`;
    }
    var okNow = st.results[st.results.length - 1].ok;
    var head = st.timedOut ? '⏱ 시간 초과 · ❤️ −1' : (st.hearts <= 0 && !okNow ? '✕ 여기까지' : (okNow ? '✓ 한 번에 찾았어요' : '✓ 찾았어요'));
    return top + paperHtml(true) +
      `<div class='sp-ans ${okNow ? 'ok' : ''}'><span class='trap-k ${okNow ? 'ok' : 'bad'}'>${head}</span><h2>${esc(it.icon || '')} ${esc(it.title)}</h2>` +
      `<p class='trap-ans'><b>무엇이 틀렸나</b> ${esc(it.choices[it.answer].t)}</p><div class='ex-fix'><b>고쳐 쓰면</b>${esc(it.fix)}</div>` +
      `<div class='btn-row'><button type='button' class='btn secondary' data-action='note-open' data-id='${esc(it.id)}'>해설 전체</button><button type='button' class='btn' data-action='sp-next'>${st.hearts <= 0 || st.idx >= st.items.length - 1 ? '결과' : '다음 문장'}</button></div></div>`;
  }
  function paint() { var b = el('sp-body'); if (b) { b.innerHTML = body(); } }
  function screen() {
    return Q().load().then(function (bank) {
      if (!bank.some(function (x) { return x.spot; })) { return back() + A().emptyCard('교정지가 없어요', '기본 콘텐츠를 받아 주세요.', ''); }
      clearInterval(timer);
      if (!st || st.phase === 'run' || st.phase === 'found') { st = fresh(); }
      return back() + `<h1 class='large-title'>틀린 그림 찾기</h1><div id='sp-body'>${body()}</div>`;
    });
  }
  document.addEventListener('keydown', function (ev) {
    if (!el('sp-body') || !st || ev.key !== 'Enter' || ev.metaKey || ev.ctrlKey) { return; }
    var sheet = document.getElementById('sheet');
    if (sheet && !sheet.hidden) { return; }
    if (ev.target && ev.target.tagName === 'BUTTON') { return; }
    if (st.phase === 'found') { next(); } else if (st.phase === 'ready' || st.phase === 'over') { start(); } else { return; }
    ev.preventDefault(); ev.stopImmediatePropagation();
  }, true);

  PHD.spot = { screen: screen, start: start, tap: tap, next: next, state: function () { return st; }, tokens: tokens, _timeout: function () { if (st && st.phase === 'run') { timeout(); } } };
})();
