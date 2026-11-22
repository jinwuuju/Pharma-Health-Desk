/* 진우주 기자 학교 — 게임 층(D018): XP·레벨·연차·장비, 연속 학습일, 오늘의 퀘스트, 캐릭터, 효과음.
   보상은 학습 행동에만 준다(기획안 1의 7.2). 저장: meta 'game', daylogs(학습일별). */
(function () {
  'use strict';
  var S = window.PHD.store, R = window.PHD.srs;

  var RANKS = [[1, '수습기자'], [3, '1년차 기자'], [5, '2년차 기자'], [8, '3년차 기자'], [11, '5년차 기자'], [15, '전문기자'], [20, '차장'], [25, '부장'], [30, '데스크']];
  var GEAR = [
    { lv: 1, id: 'badge', name: '프레스 목걸이' },
    { lv: 2, id: 'notebook', name: '취재 수첩' },
    { lv: 4, id: 'pen', name: '귀에 꽂은 볼펜' },
    { lv: 6, id: 'glasses', name: '동그란 안경' },
    { lv: 9, id: 'recorder', name: '녹음기' },
    { lv: 13, id: 'coat', name: '트렌치코트' },
    { lv: 17, id: 'headset', name: '헤드셋' },
    { lv: 22, id: 'tie', name: '넥타이' },
    { lv: 30, id: 'mug', name: '데스크 머그' }
  ];
  var XP = { review: 1, fresh: 2, combo10: 2, quests: 10 };
  var SCOOP_RATE = 0.08;          // 정답 중 8%는 ‘특종’: 그 카드 XP 2배
  var QUALIFY_REVIEWS = 20, QUALIFY_MS = 600000;   // 연속일 인정: 대기열 0, 또는 20장, 또는 10분
  var FREEZES_PER_MONTH = 2;
  var DEFAULT_GAME = { key: 'game', xp: 0, streak: 0, best: 0, lastQualified: '', freezesUsed: {}, frozenDays: [], comebackUntil: '', totalReviews: 0, totalNew: 0, sessions: 0 };

  function needFor(level) { return 40 + 20 * level; }
  function rankOf(lv) { var r = RANKS[0][1]; RANKS.forEach(function (x) { if (lv >= x[0]) { r = x[1]; } }); return r; }
  function nextRank(lv) { for (var i = 0; i < RANKS.length; i++) { if (RANKS[i][0] > lv) { return { lv: RANKS[i][0], name: RANKS[i][1] }; } } return null; }
  function gearOf(lv) { return GEAR.filter(function (g) { return g.lv <= lv; }).map(function (g) { return g.id; }); }
  function nextGear(lv) { for (var i = 0; i < GEAR.length; i++) { if (GEAR[i].lv > lv) { return GEAR[i]; } } return null; }
  function levelInfo(xp) {
    var lv = 1, base = 0;
    xp = Math.max(0, Math.floor(xp || 0));
    while (xp >= base + needFor(lv) && lv < 99) { base += needFor(lv); lv += 1; }
    return { level: lv, into: xp - base, need: needFor(lv), rank: rankOf(lv), nextRank: nextRank(lv), gear: gearOf(lv), nextGear: nextGear(lv) };
  }

  function emptyLog(day) {
    return { key: day, reviews: 0, fresh: 0, correct: 0, again: 0, xp: 0, ms: 0, maxCombo: 0, scoops: 0, qualified: false, cleared: false, bonus: false, extraNew: 0, sessions: 0 };
  }
  function merge(def, obj) { var o = {}; Object.keys(def).forEach(function (k) { o[k] = def[k]; }); Object.keys(obj || {}).forEach(function (k) { o[k] = obj[k]; }); return o; }

  // 지난 학습일부터 어제까지 빈 날을 정리한다: 월 2회 휴가권으로 메우거나, 끊고 재개 보너스(3일 XP 1.5배)를 켠다.
  function settle(g, today) {
    if (!g.lastQualified || !g.streak) { return false; }
    var gap = R.diffDays(g.lastQualified, today);
    if (gap <= 1) { return false; }
    var need = {}, days = [];
    for (var i = 1; i < gap; i++) { var d = R.addDays(g.lastQualified, i); days.push(d); need[d.slice(0, 7)] = (need[d.slice(0, 7)] || 0) + 1; }
    var ok = Object.keys(need).every(function (m) { return (g.freezesUsed[m] || 0) + need[m] <= FREEZES_PER_MONTH; });
    if (ok) {
      Object.keys(need).forEach(function (m) { g.freezesUsed[m] = (g.freezesUsed[m] || 0) + need[m]; });
      g.frozenDays = (g.frozenDays || []).concat(days).slice(-60);
      g.lastQualified = R.addDays(today, -1);
    } else {
      g.streak = 0;
      g.comebackUntil = R.addDays(today, 2);
    }
    return true;
  }

  function load(today) {
    return Promise.all([S.get('meta', 'game'), S.get('daylogs', today)]).then(function (res) {
      var g = merge(DEFAULT_GAME, res[0]);
      g.freezesUsed = g.freezesUsed || {};
      var changed = settle(g, today);
      var log = merge(emptyLog(today), res[1]);
      return (changed ? S.putMany('meta', [g]) : Promise.resolve()).then(function () { return { game: g, log: log }; });
    });
  }

  function recentLogs(today, days) {
    var keys = [];
    for (var i = days - 1; i >= 0; i--) { keys.push(R.addDays(today, -i)); }
    return S.getMany('daylogs', keys).then(function (m) { return keys.map(function (k) { return m[k] || emptyLog(k); }); });
  }

  // 한 장 평가할 때마다 바로 저장(중간에 닫아도 XP·기록이 남는다).
  function addAnswer(today, info) {
    return load(today).then(function (st) {
      var g = st.game, log = st.log;
      var gained = 0;
      if (info.first) { gained = info.isNew ? XP.fresh : XP.review; }
      if (info.correct && info.scoop) { gained *= 2; }
      if (info.combo && info.combo % 10 === 0) { gained += XP.combo10; }
      if (info.first) {
        if (info.isNew) { log.fresh += 1; g.totalNew += 1; } else { log.reviews += 1; g.totalReviews += 1; }
      }
      if (info.correct) { log.correct += 1; } else { log.again += 1; }
      if (info.scoop) { log.scoops += 1; }
      log.maxCombo = Math.max(log.maxCombo, info.combo || 0);
      log.xp += gained;
      g.xp += gained;
      return Promise.all([S.putMany('meta', [g]), S.putMany('daylogs', [log])]).then(function () { return { gained: gained, game: g, log: log }; });
    });
  }

  function quests(log, q, newLimit) {
    var reviewLeft = q ? q.review + q.learning : 0;
    var freshTarget = Math.max(0, newLimit);
    var list = [
      { id: 'review', label: '복습', done: log.reviews, target: Math.max(1, log.reviews + reviewLeft), complete: reviewLeft === 0, color: 'var(--ring-review)' },
      { id: 'fresh', label: '새 카드', done: log.fresh, target: Math.max(1, freshTarget), complete: log.fresh >= freshTarget || (q && q.freshAvailable === 0 && q.fresh === 0), color: 'var(--ring-new)' },
      { id: 'combo', label: '콤보 7', done: Math.min(7, log.maxCombo), target: 7, complete: log.maxCombo >= 7, color: 'var(--ring-apply)' }
    ];
    list.forEach(function (x) { x.ratio = x.complete ? 1 : Math.max(0, Math.min(1, x.done / x.target)); x.text = x.done + '/' + x.target; });
    if (log.reviews + reviewLeft === 0) { list[0].text = '만기 없음'; }
    if (freshTarget === 0 || (q && q.freshAvailable === 0 && !log.fresh)) { list[1].text = '새 카드 없음'; }
    return list;
  }

  /* 세션을 마칠 때: 연속일 인정, 재개 보너스, 퀘스트 3개 보너스. */
  function finishSession(today, sess, q, newLimit) {
    return load(today).then(function (st) {
      var g = st.game, log = st.log, out = { before: levelInfo(g.xp - sess.xp), bonusXp: 0, comebackXp: 0, streakUp: false };
      log.ms += sess.ms || 0;
      log.sessions += 1;
      g.sessions = (g.sessions || 0) + 1;
      if (q && q.review + q.learning === 0) { log.cleared = true; }
      if (!log.qualified && (log.cleared || log.reviews + log.fresh >= QUALIFY_REVIEWS || log.ms >= QUALIFY_MS)) {
        log.qualified = true;
        var yest = R.addDays(today, -1);
        g.streak = g.lastQualified === yest ? g.streak + 1 : (g.lastQualified === today ? g.streak : 1);
        g.best = Math.max(g.best || 0, g.streak);
        g.lastQualified = today;
        out.streakUp = true;
      }
      if (g.comebackUntil && today <= g.comebackUntil && sess.xp > 0) {
        out.comebackXp = Math.floor(sess.xp * 0.5);
        g.xp += out.comebackXp; log.xp += out.comebackXp;
      }
      var qs = quests(log, q, newLimit);
      out.quests = qs;
      if (!log.bonus && qs.every(function (x) { return x.complete; }) && (log.reviews + log.fresh) > 0) {
        log.bonus = true;
        out.bonusXp = XP.quests;
        g.xp += XP.quests; log.xp += XP.quests;
      }
      out.after = levelInfo(g.xp);
      out.game = g;
      out.log = log;
      return Promise.all([S.putMany('meta', [g]), S.putMany('daylogs', [log])]).then(function () { return out; });
    });
  }

  function addExtraNew(today, n) {
    return load(today).then(function (st) { st.log.extraNew = (st.log.extraNew || 0) + n; return S.putMany('daylogs', [st.log]); });
  }

  /* ---------- 캐릭터(직접 그린 SVG, D018) ---------- */
  var SKIN = '#FFD7B5', HAIR = '#2B2B33', INK = '#1F1F24';
  function charSvg(opts) {
    opts = opts || {};
    var gear = {};
    (opts.gear || ['badge']).forEach(function (id) { gear[id] = true; });
    var mood = opts.mood || 'idle';
    var size = opts.size || 180;
    var o = [];
    o.push(`<svg class='char mood-${mood}' width='${size}' height='${Math.round(size * 1.05)}' viewBox='0 0 200 210' role='img' aria-label='${opts.label || '내 기자 캐릭터'}'>`);
    o.push(`<ellipse class='ch-shadow' cx='100' cy='202' rx='54' ry='7'/>`);
    if (gear.mug) { o.push(`<g class='ch-mug'><rect x='160' y='176' width='22' height='24' rx='5' fill='#FFFFFF' stroke='#D1D1D6'/><path d='M182 182h4a5 5 0 0 1 0 12h-4' fill='none' stroke='#D1D1D6' stroke-width='3'/><path d='M167 170c-3-4 3-6 0-10M175 170c-3-4 3-6 0-10' stroke='#C7C7CC' stroke-width='2' fill='none' stroke-linecap='round'/></g>`); }
    o.push(`<g class='ch-body'>`);
    o.push(`<path d='M50 202C50 162 72 140 100 140S150 162 150 202Z' fill='#6EA8FE'/>`);
    if (gear.coat) { o.push(`<path d='M48 202C48 160 70 140 100 140L84 202Z' fill='#C9A77C'/><path d='M152 202C152 160 130 140 100 140L116 202Z' fill='#C9A77C'/><path d='M100 140L84 166L92 150Z M100 140L116 166L108 150Z' fill='#B08C61'/>`); }
    if (gear.tie) { o.push(`<path d='M100 146l-6 6 6 34 6-34z' fill='#E5484D'/>`); }
    o.push(`<rect x='90' y='126' width='20' height='18' rx='7' fill='${SKIN}'/>`);
    o.push(`<path d='M88 143L96 170M112 143L104 170' stroke='#FF9F0A' stroke-width='3' stroke-linecap='round'/><rect x='85' y='167' width='30' height='21' rx='4' fill='#FFFFFF' stroke='#E5E5EA'/><text x='100' y='181' text-anchor='middle' font-size='7.5' font-weight='800' fill='#0A84FF' font-family='-apple-system,system-ui,sans-serif'>PRESS</text>`);
    if (gear.notebook) { o.push(`<g class='ch-note'><rect x='30' y='154' width='28' height='34' rx='3' fill='#FFFFFF' stroke='#D1D1D6'/><path d='M35 164h18M35 170h18M35 176h12' stroke='#C7C7CC' stroke-width='2' stroke-linecap='round'/><path d='M33 154v-3M39 154v-3M45 154v-3M51 154v-3' stroke='#8E8E93' stroke-width='2' stroke-linecap='round'/><circle cx='58' cy='182' r='8' fill='${SKIN}'/></g>`); }
    if (gear.recorder) { o.push(`<g class='ch-rec'><rect x='138' y='150' width='15' height='26' rx='4' fill='#3A3A3C'/><circle cx='145.5' cy='157' r='3' fill='#FF453A'/><circle cx='142' cy='182' r='8' fill='${SKIN}'/></g>`); }
    o.push(`<circle cx='51' cy='92' r='9' fill='${SKIN}'/><circle cx='149' cy='92' r='9' fill='${SKIN}'/>`);
    o.push(`<circle cx='100' cy='88' r='50' fill='${SKIN}'/>`);
    o.push(`<path d='M50 88C46 48 74 30 102 31C134 32 156 54 150 86C142 70 126 62 106 63C92 52 70 58 62 76C58 80 53 84 50 88Z' fill='${HAIR}'/>`);
    if (gear.headset) { o.push(`<path d='M50 92C48 38 152 38 150 92' fill='none' stroke='#3A3A3C' stroke-width='6' stroke-linecap='round'/><rect x='42' y='82' width='13' height='24' rx='6' fill='#3A3A3C'/><rect x='145' y='82' width='13' height='24' rx='6' fill='#3A3A3C'/><path d='M49 106C52 118 64 122 76 120' fill='none' stroke='#3A3A3C' stroke-width='3' stroke-linecap='round'/><circle cx='78' cy='120' r='4' fill='#3A3A3C'/>`); }
    if (gear.pen) { o.push(`<g transform='rotate(-28 152 70)'><rect x='149' y='52' width='6' height='30' rx='2' fill='#FFCC00'/><path d='M149 82l3 6 3-6z' fill='#3A3A3C'/></g>`); }
    o.push(`<ellipse cx='71' cy='109' rx='7' ry='4' fill='#FF7A7A' opacity='.35'/><ellipse cx='129' cy='109' rx='7' ry='4' fill='#FF7A7A' opacity='.35'/>`);
    if (mood === 'sleep') {
      o.push(`<path d='M75 95q7 5 14 0M111 95q7 5 14 0' stroke='${INK}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M96 114q4 2 8 0' stroke='#7A3E2B' stroke-width='3' fill='none' stroke-linecap='round'/>`);
    } else if (mood === 'happy' || mood === 'cheer') {
      o.push(`<path d='M75 97q7-9 14 0M111 97q7-9 14 0' stroke='${INK}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M89 109q11 16 22 0z' fill='#7A3E2B'/><path d='M94 114q6 5 12 0' fill='#FF8FA0'/>`);
    } else if (mood === 'oops') {
      o.push(`<g class='ch-eyes'><ellipse cx='82' cy='94' rx='5' ry='6' fill='${INK}'/><ellipse cx='118' cy='94' rx='5' ry='6' fill='${INK}'/></g><path d='M93 115q7-5 14 0' stroke='#7A3E2B' stroke-width='3' fill='none' stroke-linecap='round'/>`);
    } else {
      o.push(`<g class='ch-eyes'><ellipse cx='82' cy='94' rx='5.5' ry='7' fill='${INK}'/><ellipse cx='118' cy='94' rx='5.5' ry='7' fill='${INK}'/><circle cx='84' cy='91' r='1.8' fill='#FFFFFF'/><circle cx='120' cy='91' r='1.8' fill='#FFFFFF'/></g><path d='M91 111q9 8 18 0' stroke='#7A3E2B' stroke-width='3' fill='none' stroke-linecap='round'/>`);
    }
    if (gear.glasses) { o.push(`<g fill='none' stroke='#2B2B33' stroke-width='2.5'><circle cx='82' cy='94' r='12'/><circle cx='118' cy='94' r='12'/><path d='M94 94h12'/></g>`); }
    o.push(`</g>`);
    if (mood === 'sleep') { o.push(`<text class='ch-z' x='150' y='44' font-size='20' font-weight='700' fill='var(--text3)' font-family='-apple-system,system-ui,sans-serif'>z</text><text class='ch-z z2' x='164' y='28' font-size='14' font-weight='700' fill='var(--text3)' font-family='-apple-system,system-ui,sans-serif'>z</text>`); }
    if (mood === 'cheer' || mood === 'happy') { o.push(`<g class='ch-spark' fill='#FFD60A'><path d='M30 50l3 8 8 3-8 3-3 8-3-8-8-3 8-3z'/><path d='M168 60l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'/></g>`); }
    o.push(`</svg>`);
    return o.join('');
  }

  var FLAME = `<svg class='flame' viewBox='0 0 24 24' aria-hidden='true'><path d='M12.6 2.5c.4 3-1.6 4.6-3.1 6.4C8 10.7 7 12.4 7 14.6A5 5 0 0 0 17 14.8c0-2.2-1-3.6-2-4.8.1 1.4-.6 2.5-1.6 2.9.6-3.6-.2-7.8-.8-10.4z' fill='currentColor'/></svg>`;
  var STAR = `<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z' fill='currentColor'/></svg>`;

  /* ---------- 효과음(직접 합성, 외부 파일 없음) ---------- */
  var actx = null;
  function sfx(name, on) {
    if (!on) { return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return; }
      actx = actx || new AC();
      if (actx.state === 'suspended' && actx.resume) { actx.resume(); }
      var seq = {
        flip: [[620, 0, 0.05, 'sine', 0.05]],
        good: [[784, 0, 0.09, 'sine', 0.08], [1175, 0.07, 0.12, 'sine', 0.07]],
        easy: [[784, 0, 0.08, 'sine', 0.08], [1047, 0.06, 0.08, 'sine', 0.07], [1568, 0.12, 0.14, 'sine', 0.06]],
        again: [[330, 0, 0.12, 'triangle', 0.06], [247, 0.08, 0.16, 'triangle', 0.05]],
        combo: [[1047, 0, 0.07, 'sine', 0.07], [1319, 0.06, 0.07, 'sine', 0.07], [1568, 0.12, 0.07, 'sine', 0.07], [2093, 0.18, 0.18, 'sine', 0.06]],
        scoop: [[1568, 0, 0.08, 'square', 0.03], [2093, 0.08, 0.2, 'sine', 0.07]],
        level: [[523, 0, 0.12, 'sine', 0.08], [659, 0.1, 0.12, 'sine', 0.08], [784, 0.2, 0.12, 'sine', 0.08], [1047, 0.3, 0.3, 'sine', 0.08]],
        done: [[659, 0, 0.2, 'sine', 0.06], [784, 0.05, 0.25, 'sine', 0.05], [988, 0.1, 0.35, 'sine', 0.05]]
      }[name] || [];
      var t0 = actx.currentTime + 0.01;
      seq.forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = n[3];
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(n[4], t0 + n[1] + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.02);
      });
    } catch (e) { /* 소리는 없어도 된다 */ }
  }
  function haptic(ms) { try { if (navigator.vibrate) { navigator.vibrate(ms || 8); } } catch (e) { /* 지원 안 함 */ } }

  var LINES = {
    idle: ['오늘 취재 나가 볼까요?', '카드 몇 장이면 기사 한 줄이 단단해져요.', '떠올리고 뒤집는 것, 그게 전부예요.', '근거부터 챙기는 기자가 오래 갑니다.'],
    sleep: ['쿨… 취재 카드가 기다려요.', '오늘 첫 카드를 넘겨 주세요.'],
    happy: ['오늘 마감 완료! 내일 또 봐요.', '오늘은 데스크가 칭찬하겠는데요.', '한 장 더 보면 내일이 편해져요.'],
    empty: ['취재 카드가 아직 없어요. 받아 올까요?']
  };
  function line(mood, seed) {
    var arr = LINES[mood] || LINES.idle;
    return arr[Math.abs(seed || 0) % arr.length];
  }

  window.PHD.game = {
    RANKS: RANKS, GEAR: GEAR, XP: XP, SCOOP_RATE: SCOOP_RATE, QUALIFY_REVIEWS: QUALIFY_REVIEWS,
    needFor: needFor, levelInfo: levelInfo, rankOf: rankOf, gearOf: gearOf,
    load: load, settle: settle, recentLogs: recentLogs, addAnswer: addAnswer, finishSession: finishSession, quests: quests, addExtraNew: addExtraNew,
    charSvg: charSvg, FLAME: FLAME, STAR: STAR, sfx: sfx, haptic: haptic, line: line, emptyLog: emptyLog
  };
})();
