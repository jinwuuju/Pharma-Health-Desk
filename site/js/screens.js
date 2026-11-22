/* 진우주 기자 학교 — 게임 화면 4개(D018): 홈(캐릭터·출발 버튼·퀘스트), 지도(레슨 길·보스), 도감(카드 수집), 나(프로필·장비·출석).
   화면마다 주 행동은 하나. 관리 기능은 나 → 설정으로 모았다. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, P = PHD.packs, R = PHD.srs, G = PHD.game, PL = PHD.play;
  var esc = U.esc;
  var CAL = [
    { label: 'W0 진단평가', date: '2026-11-30' },
    { label: 'W1 학습 시작', date: '2026-12-07' }
  ];
  var W0_START = '2026-11-30';
  var WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
  var EXAM_LABEL = { diagnostic: '진단평가', weekly: '주간 미니 시험', unit: '단원 시험', L1: 'PBJ L1', L2: 'PBJ L2', L3: 'PBJ L3', oral: '모의 구술' };
  var ICON = {
    check: `<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 12.5l4 4 8-9' fill='none' stroke='currentColor' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
    book: `<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M5 5.5A1.5 1.5 0 0 1 6.5 4H18v14H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H18' fill='none' stroke='currentColor' stroke-width='2' stroke-linejoin='round'/></svg>`,
    crown: `<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 8l4 3.5L12 5l4 6.5L20 8l-1.6 10H5.6z' fill='currentColor'/></svg>`,
    lock: `<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='5.5' y='10.5' width='13' height='9.5' rx='2.5' fill='currentColor'/><path d='M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5' fill='none' stroke='currentColor' stroke-width='2'/></svg>`,
    ice: `<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg>`
  };
  function A() { return PHD.app; }
  function settings() { return A().settings(); }
  function today() { return U.studyDate(settings().dayStartHour); }
  function weekday(d) { return WEEKDAY[new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay()]; }
  function nick() { return settings().nickname || '진우주'; }

  function ring(ratio, color, size) {
    size = size || 46;
    var r = size / 2 - 5, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, ratio || 0));
    return `<svg class='qring' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}' aria-hidden='true'>` +
      `<circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='${color}' stroke-opacity='.18' stroke-width='6'/>` +
      (v ? `<circle class='fg' cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='${color}' stroke-width='6' stroke-linecap='round' stroke-dasharray='${c.toFixed(1)}' stroke-dashoffset='${(c * (1 - v)).toFixed(1)}' transform='rotate(-90 ${size / 2} ${size / 2})'/>` : '') +
      `</svg>`;
  }
  function xpBar(info) { return `<div class='xpbar' role='progressbar' aria-valuemin='0' aria-valuemax='${info.need}' aria-valuenow='${info.into}'><i style='width:${Math.round(100 * info.into / info.need)}%'></i></div>`; }

  function nextEvent(day) {
    var cal = CAL.slice();
    if (settings().interviewDate) { cal.push({ label: '목표 면접일', date: settings().interviewDate }); }
    cal.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    for (var i = 0; i < cal.length; i++) {
      var d = U.daysBetween(day, cal[i].date);
      if (d >= 0) { return { label: cal[i].label, big: d === 0 ? 'D-DAY' : 'D-' + d }; }
    }
    return null;
  }

  /* ---------- 홈 ---------- */
  function home() {
    var day = today();
    return Promise.all([PL.loadDeck(), G.load(day), G.recentLogs(day, 7), P.summary()]).then(function (res) {
      var deck = res[0], game = res[1].game, log = res[1].log, week = res[2], sum = res[3];
      var info = G.levelInfo(game.xp);
      var streakOn = game.lastQualified === day;
      var hud = `<div class='hud'><span class='eyebrow'>${esc(U.koDate())}</span><span class='hud-r'>` +
        `<span class='chip streak${streakOn ? ' on' : ''}' title='연속 학습일'>${G.FLAME}<b class='num'>${game.streak}</b></span>` +
        `<span class='chip lv' title='레벨'>Lv <b class='num'>${info.level}</b></span></span></div>`;
      var mood, bubble, action, quests = '', extra = '';
      if (!deck.cards.length) {
        mood = 'sleep';
        bubble = sum.packs ? '복습 카드가 든 팩이 아직 없어요.' : G.line('empty', 0);
        action = sum.packs
          ? `<button type='button' class='play-btn' data-action='go-me'>콘텐츠 관리<span>나 → 설정</span></button>`
          : `<button type='button' class='play-btn pulse' data-action='load-builtin'>기본 콘텐츠 받기<span>W0 진단평가 · W1 전주기 지도 · 통계 시드 (감수 전)</span></button>` +
            `<button type='button' class='link-btn' data-action='load-sample'>샘플만 보기</button>`;
      } else {
        var pl = PL.plan(deck, log, day), q = pl.q, n = q.ids.length;
        var qs = G.quests(log, q, pl.limit);
        var allDone = qs.every(function (x) { return x.complete; });
        var touched = log.reviews + log.fresh > 0;
        mood = !n ? 'happy' : (touched ? 'idle' : 'sleep');
        bubble = n ? (q.misconceptions ? `착각 카드 ${q.misconceptions}장부터 바로잡아요.` : `오늘 취재 카드 ${n}장, 약 ${PL.minutes(q)}분이면 끝나요.`) : G.line('happy', log.xp);
        if (n) {
          action = `<button type='button' class='play-btn pulse' data-action='play'>${touched ? '이어서 취재' : '취재 시작'}<span class='num'>복습 ${q.review + q.learning} · 새 카드 ${q.fresh} · 약 ${PL.minutes(q)}분</span></button>`;
        } else if (q.freshAvailable > 0) {
          action = `<button type='button' class='play-btn soft' data-action='extra-new'>새 카드 5장 더<span>오늘 할 일은 끝났어요</span></button>`;
        } else {
          action = `<div class='play-btn soft static'>오늘 취재 끝<span>내일 또 만나요</span></div>`;
        }
        quests = `<div class='quests${allDone ? ' all' : ''}'>` + qs.map(function (x) {
          return `<div class='quest${x.complete ? ' done' : ''}'>${ring(x.ratio, x.color)}<span class='qi'>${x.complete ? ICON.check : ''}</span><b>${esc(x.label)}</b><span class='num'>${esc(x.text)}</span></div>`;
        }).join('') + `</div>` + (allDone ? `<p class='quest-note'>오늘의 퀘스트 3개 달성</p>` : '');
        if (pl.reduced) { extra += `<p class='quest-note warn'>복습이 몰려 오늘 새 카드를 절반으로 줄였어요.</p>`; }
      }
      var frozen = {};
      (game.frozenDays || []).forEach(function (d) { frozen[d] = true; });
      var strip = `<div class='week' aria-label='이번 주 출석'>` + week.map(function (w) {
        var cls = w.qualified ? 'on' : (frozen[w.key] ? 'ice' : (w.key === day ? 'today' : 'off'));
        var ic = w.qualified ? G.FLAME : (frozen[w.key] ? ICON.ice : '');
        return `<div class='wd ${cls}'><span>${weekday(w.key)}</span><i>${ic}</i></div>`;
      }).join('') + `</div>`;
      var ev = nextEvent(day);
      var dday = ev ? `<div class='dday'><span>${esc(ev.label)}</span><b class='num'>${esc(ev.big)}</b></div>` : '';
      var comeback = game.comebackUntil && day <= game.comebackUntil ? `<p class='quest-note'>재개 보너스 진행 중 — 오늘 XP 1.5배</p>` : '';
      return hud +
        `<section class='stage'>` +
        `<div class='bubble'>${esc(bubble)}</div>` +
        `<button type='button' class='char-btn' data-action='poke' data-mood='${mood}' aria-label='캐릭터 쓰다듬기'>${G.charSvg({ gear: info.gear, mood: mood, size: 176 })}</button>` +
        `<div class='who'><b>${esc(nick())}</b><span>${esc(info.rank)} · Lv ${info.level}</span></div>` +
        `<div class='xp-row'>${xpBar(info)}<span class='num'>${info.into} / ${info.need} XP</span></div>` +
        `</section>` + action + extra + comeback + quests + strip + dday;
    });
  }

  var pokeN = 0;
  function poke(btn) {
    pokeN += 1;
    btn.classList.remove('hop');
    void btn.offsetWidth;
    btn.classList.add('hop');
    var b = document.querySelector('.stage .bubble');
    if (b) { b.textContent = G.line(btn.getAttribute('data-mood') === 'happy' ? 'happy' : 'idle', pokeN); }
    G.haptic(6);
  }

  /* ---------- 지도 ---------- */
  var ZIG = [0, 56, 84, 56, 0, -56, -84, -56];
  function weekDate(w) { return typeof w === 'number' ? R.addDays(W0_START, 7 * w) : ''; }
  function map() {
    return Promise.all([S.getAll('packs'), S.getAll('content', 'kind', 'unit'), S.getAll('content', 'kind', 'lesson'), S.getAll('content', 'kind', 'exam'), PL.loadDeck()]).then(function (res) {
      var packs = A().sortPacks(res[0]).filter(function (pk) { return pk.courseId !== 'healthbeat'; });
      var units = res[1], lessons = res[2], exams = res[3], deck = res[4], pm = deck.pm;
      var cache = A().state.cache;
      var head = `<h1 class='large-title'>지도</h1>`;
      if (!lessons.length && !exams.length) {
        return head + A().emptyCard('아직 길이 없어요', '콘텐츠를 받으면 주차별 레슨 길이 여기에 열립니다.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`);
      }
      var day = today(), now = Date.now();
      var cardSet = {};
      deck.cards.forEach(function (c) { cardSet[c.id] = true; });
      var currentSet = false, idx = 0;
      var body = packs.map(function (pk) {
        var pu = units.filter(function (u) { return u.packId === pk.packId; }).sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
        var pl = lessons.filter(function (l) { return l.packId === pk.packId; });
        var px = exams.filter(function (x) { return x.packId === pk.packId; });
        if (!pl.length && !px.length) { return ''; }
        var ordered = [], used = {};
        pu.forEach(function (u) {
          (u.data.lessonIds || []).forEach(function (id) {
            var l = pl.filter(function (x) { return x.id === id; })[0];
            if (l && !used[l.id]) { used[l.id] = true; ordered.push({ l: l, unit: u.data.title || '' }); }
          });
        });
        pl.forEach(function (l) { if (!used[l.id]) { ordered.push({ l: l, unit: '' }); } });
        var nodes = ordered.map(function (o) {
          var l = o.l, d = l.data;
          var ids = (d.cardIds || []).filter(function (id) { return cardSet[id]; });
          var seen = 0, learned = 0, ready = 0;
          ids.forEach(function (id) {
            var p = pm[id];
            if (p && p.state !== 'new') { seen += 1; if (p.state === 'review') { learned += 1; } if (R.isDue(p, day, now)) { ready += 1; } } else { ready += 1; }
          });
          var ratio = ids.length ? learned / ids.length : 0;
          var st = ids.length && learned === ids.length ? 'done' : (seen ? 'active' : 'open');
          var cur = false;
          if (!currentSet && st !== 'done') { cur = true; currentSet = true; }
          cache[l.id] = { kind: 'lesson', title: d.title || l.id, unit: o.unit, minutes: d.minutes, cardIds: ids, seen: seen, learned: learned, ready: ready, objectives: d.objectives || [] };
          var x = ZIG[idx++ % ZIG.length];
          return `<div class='node-wrap' style='--x:${x}px'>${cur ? `<span class='node-flag'>여기부터</span>` : ''}` +
            `<button type='button' class='node ${st}${cur ? ' current' : ''}' data-action='node' data-id='${esc(l.id)}' aria-label='${esc(d.title || l.id)}'>${ring(st === 'done' ? 1 : ratio, st === 'done' ? 'var(--green)' : 'var(--blue)', 76)}<span class='node-ic'>${st === 'done' ? ICON.check : ICON.book}</span></button>` +
            `<span class='node-label'>${esc(d.title || l.id)}</span></div>`;
        }).join('');
        nodes += px.map(function (xm) {
          var d = xm.data, pr = Number(d.passRate) || 0;
          cache[xm.id] = { kind: 'exam', title: EXAM_LABEL[d.kind] || d.kind || '시험', items: Array.isArray(d.itemIds) ? d.itemIds.length : 0, minutes: d.minutes, pass: pr > 1 ? Math.round(pr) : Math.round(pr * 100) };
          var x = ZIG[idx++ % ZIG.length];
          return `<div class='node-wrap' style='--x:${x}px'><button type='button' class='node boss' data-action='node' data-id='${esc(xm.id)}' aria-label='${esc(cache[xm.id].title)}'><span class='node-ic'>${ICON.crown}</span></button><span class='node-label'>${esc(cache[xm.id].title)}</span></div>`;
        }).join('');
        var wd = weekDate(pk.week);
        return `<section class='leg'><div class='leg-head'><span class='leg-w'>${typeof pk.week === 'number' ? 'W' + pk.week : '팩'}</span><div><b>${esc(pk.title || pk.packId)}</b>${A().reviewPill(pk)}<span>${wd ? esc(U.dots(wd)) + ' 주' : esc(pk.packId)}</span></div></div><div class='path'>${nodes}</div></section>`;
      }).join('');
      return head + body + `<p class='footnote'>레슨을 누르면 그 레슨의 카드로 바로 취재합니다. 레슨 읽기는 단계 4, 시험 응시는 단계 16에서 열립니다.</p>`;
    });
  }

  function nodeSheet(id) {
    var c = A().state.cache[id];
    if (!c) { return; }
    if (c.kind === 'exam') {
      A().openSheet(`<div class='grab'></div><div class='sheet-hero boss'>${ICON.crown}</div><h2>${esc(c.title)}</h2>` +
        `<p>${c.items ? c.items + '문항 · ' : ''}${esc(c.minutes || '?')}분 · 합격 ${c.pass}%</p><p class='note'>보스 시험은 단계 16(M9)에서 열립니다. 지금은 앞의 레슨 카드를 단단히 해 두세요.</p>` +
        `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>닫기</button></div>`);
      return;
    }
    var n = c.cardIds.length;
    var obj = c.objectives.slice(0, 3).map(function (o) { return `<li>${esc(o)}</li>`; }).join('');
    A().openSheet(`<div class='grab'></div><span class='kicker'>${esc(c.unit || '레슨')}${c.minutes ? ' · ' + esc(c.minutes) + '분' : ''}</span><h2>${esc(c.title)}</h2>` +
      `<div class='sheet-stats'><div><b class='num'>${c.learned}</b><span>익힘</span></div><div><b class='num'>${c.seen}</b><span>만남</span></div><div><b class='num'>${n}</b><span>카드</span></div></div>` +
      (obj ? `<ul class='msgs'>${obj}</ul>` : '') +
      (c.ready ? `<div class='btn-row'><button type='button' class='btn' data-action='play-lesson' data-id='${esc(id)}'>이 레슨 카드로 취재 · ${c.ready}장</button></div>` : `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>${n ? '오늘 이 레슨은 끝 — 다음 복습일에 다시' : '아직 카드가 없는 레슨'}</button></div>`) +
      `<p class='note'>레슨 본문 읽기는 단계 4(M3)에서 열립니다.</p>`);
  }

  /* ---------- 도감 ---------- */
  var FILTERS = [['all', '전체'], ['learning', '익히는 중'], ['solid', '단단함'], ['unseen', '미발견']];
  function stars(n) {
    var o = '';
    for (var i = 1; i <= 4; i++) { o += `<i class='${i <= n ? 'on' : ''}'>${G.STAR}</i>`; }
    return `<span class='stars' aria-label='기억 강도 ${Math.max(0, n)} / 4'>${o}</span>`;
  }
  function dex() {
    return PL.loadDeck().then(function (deck) {
      var head = `<h1 class='large-title'>도감</h1>`;
      if (!deck.cards.length) {
        return head + A().emptyCard('도감이 비어 있어요', '콘텐츠를 받으면 카드가 여기에 모입니다. 취재에서 만난 카드가 하나씩 열려요.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`);
      }
      var f = A().state.dexFilter;
      var counts = [0, 0, 0, 0, 0, 0];
      var tiles = deck.cards.map(function (c) {
        var p = deck.pm[c.id], s = R.strength(p);
        counts[s + 1] += 1;
        var group = s < 0 ? 'unseen' : (s >= 2 ? 'solid' : 'learning');
        if (f !== 'all' && f !== group) { return ''; }
        if (s < 0) { return `<button type='button' class='tile unseen' data-action='dex-card' data-id='${esc(c.id)}'><b>?</b><span>${esc((c.data && c.data.domain) || '')}</span></button>`; }
        return `<button type='button' class='tile s${s}${p.misconception ? ' mis' : ''}' data-action='dex-card' data-id='${esc(c.id)}'><span class='tile-q'>${esc((c.data && c.data.front) || c.id)}</span>${stars(s)}</button>`;
      }).join('');
      var total = deck.cards.length, found = total - counts[0];
      var meter = `<div class='meter'>` + [[0, 'var(--text3)'], [1, 'var(--orange)'], [2, 'var(--ring-review)'], [3, 'var(--indigo)'], [4, 'var(--blue)'], [5, 'var(--green)']].map(function (m) {
        return counts[m[0]] ? `<i style='flex:${counts[m[0]]};background:${m[1]}'></i>` : '';
      }).join('') + `</div>`;
      var seg = `<div class='seg wide' role='group'>` + FILTERS.map(function (x) {
        return `<button type='button' data-action='dex-filter' data-val='${x[0]}' aria-pressed='${f === x[0] ? 'true' : 'false'}'>${x[1]}</button>`;
      }).join('') + `</div>`;
      return head + `<div class='dex-head'><div class='big num'><b>${found}</b><span>/ ${total} 발견</span></div><div class='dex-legend'><span>별 = 기억 강도</span><span>단단함 <b class='num'>${counts[3] + counts[4] + counts[5]}</b></span></div></div>` +
        meter + seg + `<div class='tiles'>${tiles || `<p class='footnote'>이 분류에 카드가 없어요.</p>`}</div>`;
    });
  }

  function cardSheet(id) {
    Promise.all([S.get('content', id), S.get('progress', id)]).then(function (res) {
      var c = res[0], p = res[1];
      if (!c) { return; }
      var d = c.data || {};
      if (!p || p.state === 'new') {
        A().openSheet(`<div class='grab'></div><div class='sheet-hero'>?</div><h2>아직 만나지 않은 카드</h2><p>${esc(d.domain || '')} · 취재에서 만나면 앞뒷면이 열립니다.</p><div class='btn-row'><button type='button' class='btn' data-action='play'>취재하러 가기</button></div>`);
        return;
      }
      var day = today();
      var dueTx = p.state === 'review' ? (p.due <= day ? '오늘' : 'D-' + R.diffDays(day, p.due)) : '오늘(익히는 중)';
      A().openSheet(`<div class='grab'></div><span class='kicker'>${esc(d.domain || '')} · ${esc(R.PHASE_LABEL[p.phase] || '')}${p.misconception ? ' · 착각 카드' : ''}</span>` +
        `<h2>${esc(d.front || c.id)}</h2><div class='card'><p>${esc(d.back || '')}</p>` +
        (d.why ? `<p class='note'><b>왜?</b> ${esc(d.why)}</p>` : '') + (d.example ? `<p class='note'><b>기사 속</b> ${esc(d.example)}</p>` : '') + `</div>` +
        `<div class='sheet-stats'><div><b class='num'>${esc(dueTx)}</b><span>다음 복습</span></div><div><b class='num'>${esc(R.fmtInterval(0, p.interval || 0))}</b><span>간격</span></div><div><b class='num'>${p.reps || 0}</b><span>복습</span></div><div><b class='num'>${p.lapses || 0}</b><span>잊음</span></div></div>` +
        `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>닫기</button></div>`);
    });
  }

  /* ---------- 나 ---------- */
  function me() {
    var day = today();
    return Promise.all([G.load(day), G.recentLogs(day, 84), PL.loadDeck()]).then(function (res) {
      var game = res[0].game, logs = res[1], deck = res[2];
      var info = G.levelInfo(game.xp);
      var found = deck.cards.filter(function (c) { return R.strength(deck.pm[c.id]) >= 0; }).length;
      var nr = info.nextRank ? `다음 연차: Lv ${info.nextRank.lv} ${esc(info.nextRank.name)}` : '최고 연차';
      var profile = `<section class='profile'>${G.charSvg({ gear: info.gear, mood: 'idle', size: 132 })}<div class='pf'>` +
        `<h1>${esc(nick())}</h1><span class='rank'>${esc(info.rank)} · Lv ${info.level}</span>${xpBar(info)}<span class='pf-sub num'>${info.into} / ${info.need} XP · ${nr}</span></div></section>`;
      var stats = `<div class='stat-grid'>` +
        `<div><b class='num'>${game.streak}</b><span>연속일</span></div><div><b class='num'>${game.best || 0}</b><span>최장 연속</span></div>` +
        `<div><b class='num'>${found}</b><span>발견한 카드</span></div><div><b class='num'>${game.xp}</b><span>총 XP</span></div></div>`;
      var gear = `<div class='section-title'>장비</div><div class='gear'>` + G.GEAR.map(function (g) {
        var on = info.level >= g.lv;
        return `<div class='gi${on ? ' on' : ''}'><i>${on ? ICON.check : ICON.lock}</i><b>${esc(g.name)}</b><span>Lv ${g.lv}</span></div>`;
      }).join('') + `</div>`;
      var max = 1;
      logs.forEach(function (l) { max = Math.max(max, l.xp || 0); });
      var heat = `<div class='section-title'>출석부 · 12주</div><div class='card'><div class='heat'>` + logs.map(function (l) {
        var lv = !l.xp ? 0 : Math.min(4, 1 + Math.floor(3 * l.xp / max));
        return `<i class='h${lv}' title='${esc(U.dots(l.key))} · ${l.xp || 0} XP'></i>`;
      }).join('') + `</div></div>`;
      var links = `<div class='section-title'></div><div class='list'>` +
        `<a class='row' href='#/me/settings'><div class='tx'>설정<span class='sub'>캐릭터 이름 · 학습량 · 콘텐츠 팩 · 백업</span></div><span class='chev'>›</span></a>` +
        `<a class='row' href='#/me/dev'><div class='tx'>개발 현황</div><span class='chev'>›</span></a></div>`;
      return profile + stats + gear + heat + links +
        `<p class='footnote'>XP는 학습 행동에만 쌓입니다: 복습 1장 1, 새 카드 2, 콤보 10마다 +2, 특종(무작위 8%) 2배, 오늘의 퀘스트 3개 +10.</p>`;
    });
  }

  PHD.screens = { home: home, map: map, dex: dex, me: me, poke: poke, nodeSheet: nodeSheet, cardSheet: cardSheet };
})();
