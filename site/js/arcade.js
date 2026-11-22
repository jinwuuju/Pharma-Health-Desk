/* 진우주 기자 학교 — 오락실(D021·D022). 같은 문제 은행을 클래식 게임 8종으로 돌려 가며 푼다(안 질리게).
   허브 · 오답 노트 · 퀴즈쇼(백만장자형) · 짝 맞추기 여기에. 지뢰찾기 mines.js, 속보 러시 rush.js, 스네이크 snake.js, 틀린 그림 찾기 spot.js, 타자 게임 typing.js, 카드 배틀 cards.js. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, G = PHD.game, R = PHD.srs;
  var esc = U.esc;
  var GAMES = [
    { id: 'mines', name: '지뢰찾기', icon: '💣', desc: '숫자로 함정을 피하고, 밟으면 4지선다로 해체', best: function (b) { return b != null ? '최고 ' + clock(b) : ''; } },
    { id: 'show', name: '퀴즈쇼', icon: '🎤', desc: '12단계 사다리, 찬스 3개로 올해의 기자상까지', best: function (b) { return b != null ? '최고 ' + b + '단계' : ''; } },
    { id: 'rush', name: '속보 러시', icon: '⚡', desc: '90초, 문장마다 정확·오보를 스와이프', best: function (b) { return b != null ? '최고 ' + b + '점' : ''; } },
    { id: 'memory', name: '짝 맞추기', icon: '🀄', desc: '오보 유형과 제목을 짝지어 뒤집기', best: function (b) { return b != null ? '최소 ' + b + '번' : ''; } },
    { id: 'snake', name: '스네이크', icon: '🐍', desc: '정답 글자를 먹고 길어져라', best: function (b) { return b != null ? '최고 ' + b + '점' : ''; } },
    { id: 'spot', name: '틀린 그림 찾기', icon: '🔍', desc: '교정지에서 오보 제목의 틀린 곳을 탭', best: function (b) { return b != null ? '최고 ' + b + '점' : ''; } },
    { id: 'typing', name: '타자 게임', icon: '⌨️', desc: '떨어지는 뜻풀이를 정확한 용어로 터뜨리기', best: function (b) { return b != null ? '최고 ' + b + '점' : ''; } },
    { id: 'cards', name: '카드 배틀', icon: '🎴', desc: '확신만큼 칩을 걸고 답 카드 고르기', best: function (b) { return b != null ? '최고 ' + b + '칩' : ''; } }
  ];
  var LADDER = ['수습 1주', '수습 3개월', '1년차', '2년차', '3년차', '5년차', '전문기자', '차장', '부장', '부국장', '편집국장', '올해의 기자상'];
  var SAFE = [3, 7];
  var Q = null, show = null, mem = null;

  function A() { return PHD.app; }
  function el(id) { return document.getElementById(id); }
  function sound() { return A().settings().sound !== false; }
  function clock(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  function todayGame() { return GAMES[((R.diffDays('2026-11-22', U.studyDate(A().settings().dayStartHour)) % GAMES.length) + GAMES.length) % GAMES.length]; }
  function back() { return `<a class='back' href='#/evidence'>‹ 오락실</a>`; }

  /* ---------- 허브 ---------- */
  function hub() {
    Q = PHD.quiz;
    return Promise.all([Q.load(), G.loadDiscover()]).then(function (res) {
      var bank = res[0], disc = res[1];
      if (!bank.length) { return `<h1 class='large-title'>오락실</h1>` + A().emptyCard('문항이 아직 없어요', '기본 콘텐츠를 받으면 오락실 게임이 열립니다.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`); }
      var st = Q.state();
      var found = bank.filter(function (b) { return disc.tr[b.id]; }).length;
      var cats = Object.keys(Q.CATS).map(function (c) {
        var all = bank.filter(function (b) { return b.cat === c; });
        if (!all.length) { return ''; }
        var right = all.filter(function (b) { var s = st.items[b.id]; return s && s.right > 0; }).length;
        return `<div class='cat-r'><span>${esc(Q.CATS[c])}</span><i><b style='width:${Math.round(100 * right / all.length)}%'></b></i><em class='num'>${right}/${all.length}</em></div>`;
      }).join('');
      var tg = todayGame();
      var tiles = GAMES.map(function (g) {
        var b = g.best(st.best[g.id]);
        return `<button type='button' class='gtile${g.id === tg.id ? ' today' : ''}' data-action='go' data-to='evidence/${g.id}'><i>${g.icon}</i><b>${esc(g.name)}</b><span>${esc(b || g.desc)}</span></button>`;
      }).join('');
      return `<h1 class='large-title'>오락실</h1>` +
        `<div class='ob-hero' data-action='go' data-to='evidence/${tg.id}'><span class='ob-k'>오늘의 게임</span><i>${tg.icon}</i><b>${esc(tg.name)}</b><p>${esc(tg.desc)}</p>` +
        `<button type='button' class='play-btn' data-action='go' data-to='evidence/${tg.id}'>플레이<span>문항 ${bank.length}개를 돌려 가며 출제</span></button></div>` +
        `<div class='gtiles'>${tiles}</div>` +
        `<div class='section-title'>오보 문항 ${found}/${bank.length} 발견 · 분야별 맞힌 문항</div><div class='card cats'>${cats}</div>` +
        `<div class='list' style='margin-top:12px'><a class='row' href='#/evidence/notes'><div class='tx'>오답 노트<span class='sub'>최근 틀린 문항 ${st.wrong.length}개 — 해설 다시 보기</span></div><span class='chev'>›</span></a></div>` +
        `<p class='footnote'>게임 8종, 형식만 다르고 문항은 같습니다(타자 게임은 용어). 처음 보는 문항과 틀렸던 문항이 먼저 나와요. 감수 전 초안입니다.</p>`;
    });
  }
  function notes() {
    Q = PHD.quiz;
    return Q.load().then(function () {
      var st = Q.state();
      var rows = st.wrong.map(function (id) {
        var it = Q.item(id);
        if (!it) { return ''; }
        return `<button type='button' class='row' data-action='note-open' data-id='${esc(id)}'><div class='tx'>${esc(it.icon || '')} ${esc(it.title)}<span class='sub'>${esc(it.headline)}</span></div><span class='chev'>›</span></button>`;
      }).join('');
      return back() + `<h1 class='large-title'>오답 노트</h1>` + (rows ? `<div class='list'>${rows}</div>` : A().emptyCard('틀린 문항이 없어요', '게임에서 틀린 문항이 여기에 모입니다.', ''));
    });
  }

  /* ---------- 퀴즈쇼(백만장자형) ---------- */
  function showNew() {
    show = { rung: 0, item: null, order: [], sel: null, phase: 'ask', life: { fifty: true, senior: true, swap: true }, hidden: {}, hint: '', over: false, won: false, results: [], used: {} };
    nextItem();
  }
  function levelFor(r) { return r < 4 ? 1 : (r < 8 ? 2 : 3); }
  function nextItem() {
    var it = Q.pick(1, { lv: levelFor(show.rung), exclude: show.used })[0] || Q.pick(1, { exclude: show.used })[0] || Q.pick(1)[0];
    show.item = it; show.used[it.id] = true; show.order = Q.order(it); show.sel = null; show.hidden = {}; show.hint = ''; show.phase = 'ask';
    Q.ask(selectChoice);
  }
  function selectChoice(k) {
    if (!show || show.phase !== 'ask') { return; }
    show.sel = k;
    G.sfx('flip', sound());
    paintShow();
  }
  function ladderHtml() {
    return `<div class='ladder-row'>` + LADDER.map(function (n, i) {
      var cls = i < show.rung ? 'done' : (i === show.rung ? 'cur' : '');
      return `<i class='${cls}${SAFE.indexOf(i) >= 0 ? ' safe' : ''}' title='${esc(n)}'></i>`;
    }).join('') + `</div>`;
  }
  function showBody() {
    var it = show.item;
    if (show.over) { return showResult(); }
    var top = `<div class='sh-top'><span class='sh-rung'><b class='num'>${show.rung + 1}</b>/12 · ${esc(LADDER[show.rung])}${SAFE.indexOf(show.rung) >= 0 ? ' 🛟' : ''}</span>` +
      `<span class='sh-life'><button type='button' class='life' data-action='sh-life' data-val='fifty'${show.life.fifty && show.phase === 'ask' ? '' : ' disabled'} title='선지 두 개 지우기'>50:50</button>` +
      `<button type='button' class='life' data-action='sh-life' data-val='senior'${show.life.senior && show.phase === 'ask' ? '' : ' disabled'} title='선배에게 묻기'>🧑‍💼</button>` +
      `<button type='button' class='life' data-action='sh-life' data-val='swap'${show.life.swap && show.phase === 'ask' ? '' : ' disabled'} title='문제 바꾸기'>🔄</button></span></div>` + ladderHtml();
    if (show.phase === 'ask' || show.phase === 'lock') {
      return top + Q.questionHtml(it, show.order, { hidden: show.hidden, selected: show.sel }) +
        (show.hint ? `<p class='pz-hint'>🧑‍💼 선배: “${esc(show.hint)}”</p>` : '') +
        `<button type='button' class='play-btn${show.phase === 'lock' ? ' lock' : ''}' data-action='sh-final'${show.sel == null || show.phase === 'lock' ? ' disabled' : ''}>${show.phase === 'lock' ? '두구두구…' : '최종 답변'}<span>${show.sel == null ? '선지를 하나 고르세요' : '되돌릴 수 없어요'}</span></button>`;
    }
    var ok = show.sel === it.answer;
    return top + Q.explainHtml(it, show.order, show.sel, { extra: ok ? LADDER[show.rung] + ' 통과' : '탈락' }) +
      `<button type='button' class='play-btn' data-action='sh-next'>${ok ? (show.rung >= LADDER.length - 1 ? '시상식으로' : '다음 단계: ' + LADDER[show.rung + 1]) : '결과 보기'}<span>Enter</span></button>`;
  }
  function safeReached() {
    var r = 0;
    SAFE.forEach(function (s) { if (show.rung > s) { r = s + 1; } });
    return r;
  }
  function showResult() {
    var reached = show.won ? LADDER.length : show.reachedFinal;
    var name = reached ? LADDER[reached - 1] : '수습 첫날';
    var list = show.results.map(function (r) { var it = Q.item(r.id); return `<button type='button' class='row' data-action='note-open' data-id='${esc(r.id)}'><div class='tx'>${r.ok ? '✓' : '✕'} ${esc(it.title)}<span class='sub'>${esc(it.headline)}</span></div><span class='chev'>›</span></button>`; }).join('');
    return `<div class='card sh-end ${show.won ? 'win' : ''}'><span class='disc-k'>${show.won ? '🏆 올해의 기자상!' : '오늘의 도전 끝'}</span><h2>${esc(name)}</h2><p class='disc-def'>${reached}/12단계${show.won ? '' : ' · 안전 지점은 2년차·차장'}</p>` +
      `<p class='disc-xp'>${show.xpText || ''}</p><div class='btn-row'><button type='button' class='btn' data-action='sh-restart'>다시 도전</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
      `<div class='section-title'>이번 판 문항 — 눌러서 해설</div><div class='list'>${list}</div>`;
  }
  function paintShow() { var b = el('sh-body'); if (b) { b.innerHTML = showBody(); } }
  function showScreen() {
    Q = PHD.quiz;
    return Q.load().then(function (bank) {
      if (!bank.length) { return back() + A().emptyCard('문항이 없어요', '기본 콘텐츠를 받아 주세요.', ''); }
      if (!show || show.over) { showNew(); } else { Q.ask(selectChoice); }
      return back() + `<h1 class='large-title'>퀴즈쇼</h1><div id='sh-body' class='sh'>${showBody()}</div>`;
    });
  }
  function showFinal() {
    if (!show || show.phase !== 'ask' || show.sel == null) { return; }
    show.phase = 'lock';
    paintShow();
    G.sfx('flip', sound());
    setTimeout(function () {
      if (!show) { return; }
      var ok = show.sel === show.item.answer;
      show.phase = 'reveal';
      show.results.push({ id: show.item.id, ok: ok });
      G.sfx(ok ? 'easy' : 'again', sound());
      if (!ok) { G.haptic(25); }
      Q.record(show.item.id, ok);
      paintShow();
    }, 900);
  }
  function showNext() {
    if (!show || show.phase !== 'reveal') { return; }
    var ok = show.sel === show.item.answer;
    if (ok && show.rung >= LADDER.length - 1) { show.won = true; return endShow(); }
    if (ok) { show.rung += 1; nextItem(); G.sfx('combo', sound()); paintShow(); window.scrollTo(0, 0); return; }
    show.reachedFinal = safeReached();
    endShow();
  }
  function endShow() {
    show.over = true;
    var reached = show.won ? LADDER.length : show.reachedFinal;
    var right = show.results.filter(function (r) { return r.ok; }).length;
    var xp = right + reached + (show.won ? 10 : 0);
    Q.setBest('show', show.won ? LADDER.length : show.rung).then(function (better) {
      return Q.award(xp, 0).then(function (out) {
        show.xpText = '+' + out.gained + ' XP' + (better ? ' · 최고 기록!' : '');
        G.sfx(show.won ? 'level' : 'done', sound());
        paintShow();
      });
    });
    paintShow();
  }
  function lifeline(kind) {
    if (!show || show.phase !== 'ask' || !show.life[kind]) { return; }
    show.life[kind] = false;
    if (kind === 'fifty') {
      var wrong = show.order.filter(function (k) { return k !== show.item.answer; });
      Q.shuffle(wrong).slice(0, 2).forEach(function (k) { show.hidden[k] = true; });
      if (show.hidden[show.sel]) { show.sel = null; }
    } else if (kind === 'senior') {
      show.hint = show.item.tip;
    } else if (kind === 'swap') {
      nextItem();
    }
    G.sfx('good', sound());
    paintShow();
  }

  /* ---------- 짝 맞추기 ---------- */
  function memNew() {
    var items = Q.pick(6);
    var cards = [];
    items.forEach(function (it) {
      cards.push({ id: it.id, side: 't', text: it.title, icon: it.icon });
      cards.push({ id: it.id, side: 'h', text: it.short || it.headline });
    });
    mem = { cards: Q.shuffle(cards), open: [], matched: {}, moves: 0, t0: 0, t1: 0, over: false, lock: false, items: items, last: null };
  }
  function memCard(c, i) {
    var up = mem.open.indexOf(i) >= 0 || mem.matched[c.id];
    var cls = 'mm' + (up ? ' up' : '') + (mem.matched[c.id] ? ' ok' : '') + (c.side === 't' ? ' t' : ' h');
    return `<button type='button' class='${cls}' data-action='mm-flip' data-i='${i}' aria-label='카드 ${i + 1}'><span class='mm-back'>?</span><span class='mm-front'>${c.side === 't' ? `<i>${esc(c.icon || '')}</i><b>${esc(c.text)}</b>` : `<em>${esc(c.text)}</em>`}</span></button>`;
  }
  function memBody() {
    if (mem.over) {
      var sec = Math.round((mem.t1 - mem.t0) / 1000);
      var stars = mem.moves <= 9 ? 3 : (mem.moves <= 13 ? 2 : 1);
      var list = mem.items.map(function (it) { return `<button type='button' class='row' data-action='note-open' data-id='${esc(it.id)}'><div class='tx'>${esc(it.icon || '')} ${esc(it.title)}<span class='sub'>${esc(it.headline)}</span></div><span class='chev'>›</span></button>`; }).join('');
      return `<div class='card sh-end win'><span class='disc-k'>모든 짝을 찾았어요</span><div class='ms-stars'>${[1, 2, 3].map(function (n) { return `<i class='${n <= stars ? 'on' : ''}'>★</i>`; }).join('')}</div>` +
        `<h2 class='num'>${mem.moves}번 · ${clock(sec)}</h2><p class='disc-xp'>${mem.xpText || ''}</p>` +
        `<div class='btn-row'><button type='button' class='btn' data-action='mm-restart'>한 판 더</button><a class='btn secondary' href='#/evidence'>다른 게임</a></div></div>` +
        `<div class='section-title'>이번 판의 오보 유형 — 눌러서 해설</div><div class='list'>${list}</div>`;
    }
    var found = Object.keys(mem.matched).length;
    return `<div class='mm-bar'><span class='ms-chip'>뒤집기 <b class='num'>${mem.moves}</b></span><span class='ms-chip'>짝 <b class='num'>${found}</b>/6</span></div>` +
      `<div class='mm-grid'>${mem.cards.map(memCard).join('')}</div>` +
      (mem.last ? `<p class='pz-hint'>${esc(mem.last.icon || '')} <b>${esc(mem.last.title)}</b> — ${esc(mem.last.tip)}</p>` : `<p class='footnote'>오보 유형(아이콘 카드)과 그 유형이 들어간 제목을 짝지으세요.</p>`);
  }
  function paintMem() { var b = el('mm-body'); if (b) { b.innerHTML = memBody(); } }
  function memScreen() {
    Q = PHD.quiz;
    return Q.load().then(function (bank) {
      if (bank.length < 6) { return back() + A().emptyCard('문항이 부족해요', '기본 콘텐츠를 받아 주세요.', ''); }
      if (!mem || mem.over) { memNew(); }
      return back() + `<h1 class='large-title'>짝 맞추기</h1><div id='mm-body'>${memBody()}</div>`;
    });
  }
  function memFlip(i) {
    i = Number(i);
    if (!mem || mem.over || mem.lock) { return; }
    var c = mem.cards[i];
    if (!c || mem.matched[c.id] || mem.open.indexOf(i) >= 0) { return; }
    if (!mem.t0) { mem.t0 = Date.now(); }
    mem.open.push(i);
    G.sfx('flip', sound());
    if (mem.open.length === 2) {
      mem.moves += 1;
      var a = mem.cards[mem.open[0]], b = mem.cards[mem.open[1]];
      if (a.id === b.id) {
        mem.matched[a.id] = true;
        mem.open = [];
        mem.last = Q.item(a.id);
        G.sfx('good', sound());
        if (Object.keys(mem.matched).length === 6) { return memEnd(); }
      } else {
        mem.lock = true;
        paintMem();
        setTimeout(function () { if (mem) { mem.open = []; mem.lock = false; paintMem(); } }, 900);
        return;
      }
    }
    paintMem();
  }
  function memEnd() {
    mem.over = true; mem.t1 = Date.now();
    var stars = mem.moves <= 9 ? 3 : (mem.moves <= 13 ? 2 : 1);
    paintMem();
    Q.recordMany(mem.items.map(function (it) { return { id: it.id, ok: true }; })).then(function (news) {
      return Q.setBest('memory', mem.moves, true).then(function (better) {
        return Q.award(3 + stars, news).then(function (out) {
          mem.xpText = '+' + out.gained + ' XP' + (news ? ' · 새 오보 유형 ' + news + '개' : '') + (better ? ' · 최소 기록!' : '');
          G.sfx('level', sound());
          paintMem();
        });
      });
    });
  }

  /* ---------- 라우터·키보드 ---------- */
  function screen(sub) {
    if (sub === 'mines') { return PHD.mines.screen(); }
    if (sub === 'show') { return showScreen(); }
    if (sub === 'rush') { return PHD.rush.screen(); }
    if (sub === 'memory') { return memScreen(); }
    if (sub === 'snake') { return PHD.snake.screen(); }
    if (sub === 'spot') { return PHD.spot.screen(); }
    if (sub === 'typing') { return PHD.typing.screen(); }
    if (sub === 'cards') { return PHD.cards.screen(); }
    if (sub === 'notes') { return notes(); }
    return hub();
  }
  document.addEventListener('keydown', function (ev) {
    if (!el('sh-body') || !show || ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
    var sheet = document.getElementById('sheet');
    if (sheet && !sheet.hidden) { return; }
    var t = ev.target && ev.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') { return; }
    var k = String(ev.key || '').toLowerCase(), used = true;
    var idx = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 }[k];
    if (idx != null && show.phase === 'ask') { var key = show.order[idx]; if (key != null && !show.hidden[key]) { selectChoice(key); } }
    else if (k === 'enter') { if (show.phase === 'ask') { showFinal(); } else if (show.phase === 'reveal') { showNext(); } else { used = false; } }
    else { used = false; }
    if (used) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);

  PHD.arcade = {
    GAMES: GAMES, LADDER: LADDER, screen: screen, todayGame: todayGame,
    showFinal: showFinal, showNext: showNext, lifeline: lifeline, showRestart: function () { show = null; A().refresh(); },
    memFlip: memFlip, memRestart: function () { mem = null; A().refresh(); },
    _show: function () { return show; }, _mem: function () { return mem; }
  };
})();
