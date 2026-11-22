/* 진우주 기자 학교 — 오락실: 카드 배틀(확신 베팅, D022). 칩 100개로 10판. 답 카드를 고르고 확신만큼 칩을 건다.
   맞히면 건 만큼 따고, 틀리면 잃는다. 끝나면 ‘크게 걸 때 더 맞혔나’ 보정 결과(기획안 1의 P11 확신도 보정). */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, G = PHD.game;
  var esc = U.esc;
  var ROUNDS = 10, START = 100;
  var BETS = [['10', 10], ['25', 25], ['50', 50], ['올인', -1]];
  var SUITS = [['♠', 's'], ['♥', 'h'], ['♦', 'd'], ['♣', 'c']];
  var st = null;

  function A() { return PHD.app; }
  function Q() { return PHD.quiz; }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function back() { return `<a class='back' href='#/evidence'>‹ 오락실</a>`; }

  function fresh() { return { phase: 'ready', round: 0, chips: START, item: null, order: [], sel: null, bet: 10, results: [], delta: 0, xpText: '', used: {} }; }
  function deal() {
    var lv = st.round < 3 ? 1 : (st.round < 7 ? 2 : 3);
    st.item = Q().pick(1, { lv: lv, exclude: st.used })[0] || Q().pick(1)[0];
    st.used[st.item.id] = true;
    st.order = Q().order(st.item);
    st.sel = null;
    st.bet = Math.min(10, st.chips);
    st.phase = 'pick';
    G.sfx('flip', sound());
  }
  function start() { Q().resetSession(); st = fresh(); deal(); paint(); }
  function pickCard(k) {
    if (!st || st.phase !== 'pick') { return; }
    st.sel = Number(k);
    G.sfx('flip', sound());
    paint();
  }
  function setBet(v) {
    if (!st || st.phase !== 'pick') { return; }
    v = Number(v);
    st.bet = v < 0 ? st.chips : Math.min(v, st.chips);
    G.sfx('good', sound());
    paint();
  }
  function betNow() {
    if (!st || st.phase !== 'pick' || st.sel == null || st.bet <= 0) { return; }
    var ok = st.sel === st.item.answer;
    st.delta = ok ? st.bet : -st.bet;
    st.chips += st.delta;
    st.results.push({ id: st.item.id, ok: ok, bet: st.bet, share: st.bet / Math.max(1, st.chips - st.delta) });
    st.phase = 'reveal';
    G.sfx(ok ? 'easy' : 'again', sound());
    if (!ok) { G.haptic(25); }
    Q().record(st.item.id, ok);
    paint();
  }
  function next() {
    if (!st || st.phase !== 'reveal') { return; }
    st.round += 1;
    if (st.chips <= 0 || st.round >= ROUNDS) { return end(); }
    deal();
    paint();
    window.scrollTo(0, 0);
  }
  function calib() {
    var g = { small: [0, 0], big: [0, 0] };
    st.results.forEach(function (r) { var k = r.share >= 0.4 ? 'big' : 'small'; g[k][1] += 1; if (r.ok) { g[k][0] += 1; } });
    return g;
  }
  function end() {
    st.phase = 'over';
    paint();
    var right = st.results.filter(function (r) { return r.ok; }).length;
    Q().setBest('cards', st.chips).then(function (better) {
      return Q().award(right + Math.floor(Math.max(0, st.chips) / 50) + (better ? 3 : 0), 0).then(function (out) {
        st.xpText = '+' + out.gained + ' XP' + (better ? ' · 최고 기록!' : '');
        G.sfx(st.chips > START ? 'level' : 'done', sound());
        paint();
      });
    });
  }

  function pct(a) { return a[1] ? Math.round(100 * a[0] / a[1]) + '%' : '—'; }
  function cardHtml(k, i, reveal) {
    var it = st.item, s = SUITS[i];
    var cls = 'pc ' + s[1] + (st.sel === k ? ' sel' : '') + (reveal && k === it.answer ? ' win' : '') + (reveal && st.sel === k && k !== it.answer ? ' lose' : '');
    return `<button type='button' class='${cls}' data-action='cb-pick' data-k='${k}'${reveal ? ' disabled' : ''}><span class='pc-c'>${Q().LETTERS[i]}<i>${s[0]}</i></span><span class='pc-t'>${esc(it.choices[k].t)}</span></button>`;
  }
  function body() {
    if (st.phase === 'ready') {
      var best = Q().state().best.cards;
      return `<div class='card ru-intro'><i>🃏</i><h2>카드 배틀</h2><p>칩 ${START}개로 10판. 답 카드를 고르고 <b>확신만큼</b> 칩을 거세요.<br>맞히면 건 만큼 따고, 틀리면 잃어요.</p>` +
        `<p class='note'>끝나면 확신과 실력이 맞았는지 보여 줘요${best != null ? ' · 최고 ' + best + '칩' : ''}</p><button type='button' class='play-btn' data-action='cb-start'>딜<span>Enter</span></button></div>`;
    }
    if (st.phase === 'over') {
      var g = calib(), right = st.results.filter(function (r) { return r.ok; }).length;
      var bigAcc = g.big[1] ? g.big[0] / g.big[1] : null, smallAcc = g.small[1] ? g.small[0] / g.small[1] : null;
      var msg = bigAcc == null || smallAcc == null ? '크게 건 판과 작게 건 판이 모두 있어야 보정을 볼 수 있어요.'
        : (bigAcc >= smallAcc ? '확신이 클 때 더 잘 맞혔어요. 확신과 실력이 잘 맞습니다.' : '크게 걸 때 더 틀렸어요. ‘확실하다’는 느낌을 한 번 더 점검해 보세요.');
      var list = st.results.map(function (r) { var it = Q().item(r.id); return `<button type='button' class='row' data-action='note-open' data-id='${esc(r.id)}'><div class='tx'>${r.ok ? '✓ +' : '✕ −'}${r.bet} ${esc(it.title)}<span class='sub'>${esc(it.headline)}</span></div><span class='chev'>›</span></button>`; }).join('');
      return `<div class='card sh-end ${st.chips > START ? 'win' : ''}'><span class='disc-k'>${st.chips <= 0 ? '파산' : '게임 끝'}</span><h2 class='num'>🪙 ${st.chips}</h2><p class='disc-def'>${right}/${st.results.length} 정답 · 시작 ${START}칩</p><p class='disc-xp'>${esc(st.xpText)}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='cb-start'>한 판 더</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
        `<div class='section-title'>확신 보정</div><div class='card'><div class='pz-stats cb-cal'><div><b class='num'>${pct(g.big)}</b><span>크게 건 판(칩 40%↑) 정답률 · ${g.big[1]}판</span></div><div><b class='num'>${pct(g.small)}</b><span>작게 건 판 정답률 · ${g.small[1]}판</span></div></div><p class='note'>${esc(msg)}</p></div>` +
        `<div class='section-title'>이번 판 문항 — 눌러서 해설</div><div class='list'>${list}</div>`;
    }
    var it = st.item, reveal = st.phase === 'reveal';
    var top = `<div class='ru-top'><span class='ms-chip cb-chips'>🪙 <b class='num'>${st.chips}</b></span><span class='ms-chip'>판 <b class='num'>${st.round + 1}</b>/${ROUNDS}</span></div>`;
    var qcard = `<div class='pc-q'><span class='qz-cat'>${esc(it.catName || '')} · 난도 ${'●●●'.slice(0, it.lv || 1)}</span><p>${esc(it.headline)}</p><span class='pc-q-k'>이 문장의 가장 큰 문제는?</span></div>`;
    var hand = `<div class='pc-hand'>${st.order.map(function (k, i) { return cardHtml(k, i, reveal); }).join('')}</div>`;
    if (!reveal) {
      var chips = `<div class='cb-bets' role='group' aria-label='칩 걸기'>` + BETS.map(function (b) {
        var v = b[1] < 0 ? st.chips : Math.min(b[1], st.chips), on = st.bet === v;
        return `<button type='button' class='chip-b${on ? ' on' : ''}' data-action='cb-bet' data-val='${b[1]}'${b[1] > st.chips ? ' disabled' : ''}>${b[0]}</button>`;
      }).join('') + `</div>`;
      return top + qcard + hand + chips + `<button type='button' class='play-btn' data-action='cb-go'${st.sel == null ? ' disabled' : ''}>${st.sel == null ? '카드를 고르세요' : '🪙 ' + st.bet + ' 걸기'}<span>확신이 클수록 크게</span></button>`;
    }
    var ok = st.delta > 0;
    return top + qcard + hand + `<div class='cb-res ${ok ? 'ok' : 'bad'}'>${ok ? '+' : '−'}${Math.abs(st.delta)} 칩</div>` +
      Q().explainHtml(it, st.order, st.sel, { extra: ok ? '딜러를 이겼어요' : '칩을 잃었어요' }) +
      `<button type='button' class='play-btn' data-action='cb-next'>${st.chips <= 0 || st.round >= ROUNDS - 1 ? '결과' : '다음 판'}<span>Enter</span></button>`;
  }
  function paint() { var b = el('cb-body'); if (b) { b.innerHTML = body(); } }
  function screen() {
    return Q().load().then(function (bank) {
      if (!bank.length) { return back() + A().emptyCard('카드가 없어요', '기본 콘텐츠를 받아 주세요.', ''); }
      if (!st) { st = fresh(); }
      return back() + `<h1 class='large-title'>카드 배틀</h1><div id='cb-body' class='cb'>${body()}</div>`;
    });
  }
  document.addEventListener('keydown', function (ev) {
    if (!el('cb-body') || !st || ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
    var sheet = document.getElementById('sheet');
    if (sheet && !sheet.hidden) { return; }
    var k = String(ev.key || '').toLowerCase(), used = true;
    var idx = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 }[k];
    if (idx != null && st.phase === 'pick') { pickCard(st.order[idx]); }
    else if (k === 'enter' && (!ev.target || ev.target.tagName !== 'BUTTON')) {
      if (st.phase === 'pick') { betNow(); } else if (st.phase === 'reveal') { next(); } else { start(); }
    } else { used = false; }
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);

  PHD.cards = { screen: screen, start: start, pick: pickCard, bet: setBet, go: betNow, next: next, state: function () { return st; } };
})();
