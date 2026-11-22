/* 진우주 기자 학교 — 취재(복습 세션) 플레이어. 기획안 1의 9.3 복습 플레이어를 게임 화면으로(D018).
   흐름: 앞면 → 확신도(모름·애매·확실)를 누르면 뒤집힘 → 4단계 평가(다음 간격 미리보기) → 다음 카드 → 결과. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, R = PHD.srs, G = PHD.game;
  var esc = U.esc;
  var sess = null;
  var CONF = [['unknown', '모름', 'Q'], ['unsure', '애매', 'W'], ['sure', '확실', 'E']];
  var GRADES = [[1, '다시', 'again'], [2, '어려움', 'hard'], [3, '알맞음', 'good'], [4, '쉬움', 'easy']];
  var CLOSE = `<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18' stroke='currentColor' stroke-width='2.4' stroke-linecap='round'/></svg>`;

  function el(id) { return document.getElementById(id); }
  function app() { return PHD.app; }
  function settings() { return app().settings(); }

  /* ---------- 카드 묶음과 오늘 계획(홈 화면과 같이 쓴다) ---------- */
  /* 덱: 코스 2(HEALTH BEAT) 먼저, PIPELINE은 열기 전까지 제외(D019). 발견해야 열리는 카드(unlock)는 발견한 순서대로. */
  function loadDeck() {
    return Promise.all([S.getAll('content', 'kind', 'card'), S.getAll('progress'), S.getAll('packs'), G.loadDiscover()]).then(function (res) {
      var st = settings();
      var week = {};
      res[2].forEach(function (pk) { week[pk.packId] = typeof pk.week === 'number' ? pk.week : 99; });
      var disc = res[3];
      function unlockedAt(c) {
        var u = c.data && c.data.unlock;
        if (!u || !u.type) { return 0; }
        var m = disc[u.type] || {};
        return m[u.id] || -1;
      }
      var all = res[0].filter(function (c) { return c.courseId !== 'pipeline' || !!st.pipelineOpen; });
      all.sort(function (a, b) {
        var ca = a.courseId === 'healthbeat' ? 0 : 1, cb = b.courseId === 'healthbeat' ? 0 : 1;
        if (ca !== cb) { return ca - cb; }
        var ua = unlockedAt(a), ub = unlockedAt(b);
        if (ua !== ub) { return (ua < 0 ? 9e15 : ua) - (ub < 0 ? 9e15 : ub); }
        return ((week[a.packId] || 0) - (week[b.packId] || 0)) || (a.id < b.id ? -1 : 1);
      });
      var cards = all.filter(function (c) { return unlockedAt(c) >= 0; });
      var pm = {};
      res[1].forEach(function (p) { if (p && p.kind === 'card') { pm[p.id] = p; } });
      return { cards: cards, all: all, pm: pm, packs: res[2], discover: disc };
    });
  }

  // 지금 남은 복습(연속일·퀘스트 계산용).
  function today() { return U.studyDate(settings().dayStartHour); }
  function status() {
    var day = today();
    return Promise.all([loadDeck(), G.load(day)]).then(function (res) { var p = plan(res[0], res[1].log, day); p.deck = res[0]; p.log = res[1].log; p.game = res[1].game; return p; });
  }

  function plan(deck, log, today) {
    var st = settings();
    var maxReviews = Number(st.maxReviews) || 80;
    var list = Object.keys(deck.pm).map(function (k) { return deck.pm[k]; });
    var adj = R.adjustNewLimit(Number(st.dailyNew) || 0, R.forecast(list, today, 7), maxReviews);
    var limit = adj.limit + (log.extraNew || 0);
    var q = R.buildQueue(deck.cards, deck.pm, { today: today, now: Date.now(), maxReviews: maxReviews, reviewsDone: log.reviews, newLimit: limit, newDone: log.fresh });
    return { q: q, limit: limit, reduced: adj.reduced };
  }

  function minutes(q) { return Math.max(1, Math.round(((q.review + q.learning) * 8 + q.fresh * 25) / 60)); }

  /* ---------- 시작 ---------- */
  function start(opts) {
    opts = opts || {};
    if (sess) { return Promise.resolve(false); }
    var st = settings();
    var today = U.studyDate(st.dayStartHour);
    return Promise.all([loadDeck(), G.load(today)]).then(function (res) {
      var deck = res[0], log = res[1].log, q;
      if (opts.ids) {
        q = R.buildQueue(deck.cards, deck.pm, { today: today, now: Date.now(), maxReviews: Number(st.maxReviews) || 80, reviewsDone: log.reviews, newLimit: 10, newDone: 0, onlyIds: opts.ids });
      } else {
        q = plan(deck, log, today).q;
      }
      if (!q.ids.length) { app().toast(opts.ids ? '이 레슨에서 지금 볼 카드가 없어요.' : '지금 볼 카드가 없어요.'); return false; }
      var byId = {};
      deck.cards.forEach(function (c) { byId[c.id] = c; });
      sess = {
        today: today, queue: q.ids.slice(), byId: byId, pm: deck.pm, seen: {}, total: q.ids.length, done: 0,
        combo: 0, maxCombo: 0, xp: 0, correct: 0, answered: 0, startedAt: Date.now(), shownAt: 0,
        conf: null, flipped: false, current: null, busy: false, title: opts.title || '', results: false
      };
      document.body.classList.add('playing');
      var box = el('play');
      box.hidden = false;
      box.innerHTML = shell();
      next();
      return true;
    });
  }

  function shell() {
    return `<div class='pl' role='dialog' aria-modal='true' aria-label='취재'>` +
      `<div class='pl-top'><button type='button' class='pl-x' data-play='exit' aria-label='그만하기 (Esc)'>${CLOSE}</button>` +
      `<div class='pl-bar' role='progressbar' aria-valuemin='0' aria-valuemax='100'><i id='pl-bar'></i></div>` +
      `<div class='pl-combo' id='pl-combo' aria-live='polite'></div></div>` +
      `<div class='pl-stage'><div class='pl-card' id='pl-card'></div><div class='pl-pop' id='pl-pop' aria-live='polite'></div></div>` +
      `<div class='pl-actions' id='pl-actions'></div></div>`;
  }

  function bar() {
    var b = el('pl-bar');
    if (b) { b.style.width = Math.round(100 * sess.done / Math.max(1, sess.total)) + '%'; b.parentNode.setAttribute('aria-valuenow', String(Math.round(100 * sess.done / Math.max(1, sess.total)))); }
    var c = el('pl-combo');
    if (c) { c.innerHTML = sess.combo >= 2 ? `${G.FLAME}<b class='num'>${sess.combo}</b>` : ''; c.classList.toggle('hot', sess.combo >= 5); }
  }

  function tags(card, p) {
    var d = card.data || {}, out = [];
    if (!p || p.state === 'new') { out.push(`<span class='tag new'>NEW</span>`); }
    if (p && p.misconception) { out.push(`<span class='tag mis'>착각</span>`); }
    if (d.domain) { out.push(`<span class='tag'>${esc(d.domain)}</span>`); }
    if (d.needsVerification) { out.push(`<span class='tag warn'>확인 필요</span>`); }
    return out.join('');
  }

  function next() {
    if (!sess) { return; }
    if (!sess.queue.length) { finish(); return; }
    sess.current = sess.queue.shift();
    sess.conf = null;
    sess.flipped = false;
    sess.shownAt = Date.now();
    var card = sess.byId[sess.current];
    if (!card) { next(); return; }
    var p = sess.pm[card.id];
    var d = card.data || {};
    el('pl-card').className = 'pl-card in';
    el('pl-card').innerHTML = `<div class='pl-tags'>${tags(card, p)}</div><div class='pl-q'>${esc(d.front || card.id)}</div>${d.en ? `<div class='pl-en'>${esc(d.en)}</div>` : ''}`;
    el('pl-actions').innerHTML = `<p class='pl-hint'>떠올렸나요? 확신만큼 눌러 뒤집으세요</p><div class='pl-conf'>` +
      CONF.map(function (c) { return `<button type='button' class='cbtn ${c[0]}' data-play='conf' data-conf='${c[0]}'>${c[1]}<kbd>${c[2]}</kbd></button>`; }).join('') + `</div>`;
    bar();
  }

  function flip(conf) {
    if (!sess || sess.flipped || sess.results) { return; }
    sess.conf = conf || 'unsure';
    sess.flipped = true;
    var card = sess.byId[sess.current], d = card.data || {};
    var prev = sess.pm[card.id] || R.newProgress(card);
    var st = settings();
    var labels = R.preview(prev, { today: sess.today, now: Date.now(), confidence: sess.conf, maxInterval: R.MAX_IVL });
    G.sfx('flip', st.sound !== false);
    el('pl-card').className = 'pl-card flipped';
    el('pl-card').innerHTML = `<div class='pl-tags'>${tags(card, sess.pm[card.id])}</div><div class='pl-q sm'>${esc(d.front || '')}</div>` +
      `<div class='pl-a'>${esc(d.back || '')}</div>` +
      (d.why ? `<div class='pl-more'><b>왜?</b> ${esc(d.why)}</div>` : '') +
      (d.example ? `<div class='pl-more'><b>기사 속</b> ${esc(d.example)}</div>` : '');
    var capped = sess.conf === 'unknown';
    el('pl-actions').innerHTML = `<div class='pl-grades'>` + GRADES.map(function (g, i) {
      var dim = capped && g[0] >= 3 ? ` title='모름이면 어려움으로 기록됩니다'` : '';
      return `<button type='button' class='gbtn ${g[2]}' data-play='grade' data-grade='${g[0]}'${dim}><span>${g[1]}</span><small class='num'>${esc(labels[i])}</small><kbd>${g[0]}</kbd></button>`;
    }).join('') + `</div>`;
  }

  function pop(html, cls) {
    var p = el('pl-pop');
    if (!p) { return; }
    var n = document.createElement('div');
    n.className = 'pop ' + (cls || '');
    n.innerHTML = html;
    p.appendChild(n);
    setTimeout(function () { if (n.parentNode) { n.parentNode.removeChild(n); } }, 1300);
  }

  function grade(g) {
    if (!sess || !sess.flipped || sess.busy || sess.results) { return; }
    sess.busy = true;
    var st = settings();
    var sound = st.sound !== false;
    var card = sess.byId[sess.current];
    var prev = sess.pm[card.id] || R.newProgress(card);
    var res = R.answer(prev, g, { today: sess.today, now: Date.now(), confidence: sess.conf, maxInterval: R.MAX_IVL, interviewDate: st.interviewDate || '' });
    var first = !sess.seen[card.id];
    sess.seen[card.id] = true;
    sess.pm[card.id] = res.progress;
    sess.answered += 1;
    sess.combo = res.correct ? sess.combo + 1 : 0;
    sess.maxCombo = Math.max(sess.maxCombo, sess.combo);
    if (res.correct) { sess.correct += 1; }
    var scoop = res.correct && first && Math.random() < G.SCOOP_RATE;
    var attempt = {
      id: card.id + '@' + Date.now(), itemId: card.id, courseId: card.courseId || 'pipeline', kind: 'card', day: sess.today,
      at: new Date().toISOString(), grade: g, effectiveGrade: res.grade, confidence: sess.conf, ms: Date.now() - sess.shownAt,
      wasNew: res.wasNew, interval: res.progress.interval, due: res.progress.due
    };
    var cardEl = el('pl-card');
    if (res.correct) {
      G.sfx(scoop ? 'scoop' : (g === 4 ? 'easy' : 'good'), sound);
      if (sess.combo > 0 && sess.combo % 5 === 0) { G.sfx('combo', sound); pop(`${G.FLAME} ${sess.combo} 콤보!`, 'combo'); }
      if (cardEl) { cardEl.className = 'pl-card out-good'; }
    } else {
      G.sfx('again', sound);
      G.haptic(12);
      if (cardEl) { cardEl.className = 'pl-card out-again'; }
    }
    if (res.misconception) { pop('착각 카드 — 내일 다시 나와요', 'mis'); }
    if (res.demoted) { pop('안전성 신호 — 단계가 한 칸 내려갔어요', 'mis'); }
    if (res.requeueMin) {
      var pos = res.requeueMin <= 1 ? Math.min(2, sess.queue.length) : sess.queue.length;
      sess.queue.splice(pos, 0, card.id);
    } else {
      sess.done += 1;
    }
    Promise.all([
      S.putMany('progress', [res.progress]),
      S.putMany('attempts', [attempt]),
      G.addAnswer(sess.today, { first: first, isNew: res.wasNew && first, correct: res.correct, scoop: scoop, combo: res.correct ? sess.combo : 0 })
    ]).then(function (out) {
      var gained = out[2].gained;
      if (!sess) { return; }
      sess.xp += gained;
      if (gained) { pop(`+${gained} XP` + (scoop ? ` <b>특종!</b>` : ''), scoop ? 'scoop' : 'xp'); }
      bar();
      setTimeout(function () { if (sess) { sess.busy = false; next(); } }, 220);
    }).catch(function (e) {
      if (sess) { sess.busy = false; }
      app().toast('저장하지 못했습니다: ' + (e && e.message ? e.message : e));
    });
  }

  /* ---------- 결과 ---------- */
  function finish() {
    if (!sess || sess.results) { return; }
    sess.results = true;
    var s = sess;
    var ms = Date.now() - s.startedAt;
    if (!s.answered) { close(); return; }
    loadDeck().then(function (deck) {
      return G.load(s.today).then(function (st) {
        var p = plan(deck, st.log, s.today);
        return G.finishSession(s.today, { xp: s.xp, ms: ms }, p.q);
      });
    }).then(function (out) {
      renderResults(s, out, ms);
    }).catch(function (e) {
      app().toast('결과를 저장하지 못했습니다: ' + (e && e.message ? e.message : e));
      close();
    });
  }

  function renderResults(s, out, ms) {
    var st = settings();
    var acc = Math.round(100 * s.correct / Math.max(1, s.answered));
    var total = s.xp + out.bonusXp + out.comebackXp;
    var up = out.after.level > out.before.level;
    var from = up ? 0 : out.before.into / out.before.need;
    var to = out.after.into / out.after.need;
    var newGear = up ? G.GEAR.filter(function (x) { return x.lv > out.before.level && x.lv <= out.after.level; }) : [];
    var extra = [];
    if (out.streakUp) { extra.push(`<div class='rs-line streak'>${G.FLAME}<span>연속 <b class='num'>${out.game.streak}</b>일째</span></div>`); }
    if (out.bonusXp) { extra.push(`<div class='rs-line'>오늘의 퀘스트 3개 달성 <b>+${out.bonusXp} XP</b></div>`); }
    if (out.comebackXp) { extra.push(`<div class='rs-line'>재개 보너스 <b>+${out.comebackXp} XP</b></div>`); }
    var mins = Math.max(1, Math.round(ms / 60000));
    el('play').innerHTML = `<div class='pl rs' role='dialog' aria-modal='true' aria-label='취재 결과'>` +
      `<div class='rs-hero'>${G.charSvg({ gear: out.after.gear, mood: 'cheer', size: 150 })}</div>` +
      `<h1 class='rs-title'>취재 완료</h1>` +
      `<div class='rs-xp'><b class='num' data-count='${total}'>${total}</b><span>XP</span></div>` +
      `<div class='rs-stats'><div><b class='num'>${acc}%</b><span>정확도</span></div><div><b class='num'>${s.maxCombo}</b><span>최고 콤보</span></div><div><b class='num'>${s.done}</b><span>카드</span></div><div><b class='num'>${mins}분</b><span>시간</span></div></div>` +
      `<div class='rs-level'><div class='rs-lv'><span>Lv ${out.after.level} · ${esc(out.after.rank)}</span><span class='num'>${out.after.into} / ${out.after.need}</span></div><div class='xpbar'><i id='rs-bar' style='width:${Math.round(from * 100)}%'></i></div></div>` +
      (up ? `<div class='rs-up'><b>레벨 업!</b> Lv ${out.after.level} · ${esc(out.after.rank)}${newGear.length ? `<span>새 장비: ${esc(newGear.map(function (x) { return x.name; }).join(', '))}</span>` : ''}</div>` : '') +
      extra.join('') +
      `<button type='button' class='play-btn' data-play='close'>계속<kbd>Enter</kbd></button></div>`;
    G.sfx(up ? 'level' : 'done', st.sound !== false);
    countUp(el('play').querySelector('[data-count]'), total);
    setTimeout(function () { var b = el('rs-bar'); if (b) { b.style.width = Math.round(to * 100) + '%'; } }, 120);
    var btn = el('play').querySelector('[data-play=close]');
    if (btn) { btn.focus(); }
  }

  function countUp(node, total) {
    if (!node || !total || !window.requestAnimationFrame) { return; }
    var t0 = 0, dur = 700;
    function step(t) {
      if (!t0) { t0 = t; }
      var k = Math.min(1, (t - t0) / dur);
      node.textContent = String(Math.round(total * (1 - Math.pow(1 - k, 3))));
      if (k < 1) { window.requestAnimationFrame(step); }
    }
    node.textContent = '0';
    window.requestAnimationFrame(step);
    setTimeout(function () { node.textContent = String(total); }, dur + 300);   // 화면이 가려져 애니메이션이 멈춰도 최종값
  }

  function close() {
    sess = null;
    var box = el('play');
    box.hidden = true;
    box.innerHTML = '';
    document.body.classList.remove('playing');
    app().refresh();
  }

  function exit() {
    if (!sess) { return; }
    if (sess.results) { close(); return; }
    if (!sess.answered) { close(); return; }
    finish();
  }

  /* ---------- 입력 ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-play]') : null;
    if (!t || !sess) { return; }
    var a = t.getAttribute('data-play');
    if (a === 'conf') { flip(t.getAttribute('data-conf')); }
    else if (a === 'grade') { grade(Number(t.getAttribute('data-grade'))); }
    else if (a === 'exit') { exit(); }
    else if (a === 'close') { close(); }
  });
  document.addEventListener('keydown', function (ev) {
    if (!sess) { return; }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
    var k = String(ev.key || '').toLowerCase();
    var used = true;
    if (k === 'escape') { exit(); }
    else if (sess.results) { if (k === 'enter' || k === ' ') { close(); } else { used = false; } }
    else if (!sess.flipped) {
      if (k === 'q') { flip('unknown'); } else if (k === 'w' || k === ' ' || k === 'enter') { flip('unsure'); } else if (k === 'e') { flip('sure'); } else { used = false; }
    } else if (k >= '1' && k <= '4') { grade(Number(k)); }
    else if (k === ' ' || k === 'enter') { grade(3); }
    else { used = false; }
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);

  PHD.play = { start: start, loadDeck: loadDeck, plan: plan, status: status, minutes: minutes, active: function () { return !!sess; } };
})();
