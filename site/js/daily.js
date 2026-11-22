/* 진우주 기자 학교 — 오늘의 퍼즐(Wordle형, D019·D020). 하루 한 문제(출석·기록·공유) + 끝나면 ‘한 문제 더’ 연습은 무제한.
   오늘의 진단: 질환을 맞히면 계통·주차·렌즈·검사·치료 칸이 초록(같음)·노랑(일부)·회색(다름)으로 답한다.
   오늘의 숫자: 통계 레지스트리의 숫자를 ±5% 안으로 맞힌다(↑↓와 근접도). */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, G = PHD.game, R = PHD.srs;
  var esc = U.esc;
  var DAY1 = '2026-11-22', TRIES = 6;
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  var EMO = { g: '🟩', y: '🟨', n: '⬜' };
  var cache = null, busy = false;

  function A() { return PHD.app; }
  function today() { return U.studyDate(A().settings().dayStartHour); }
  function el(id) { return document.getElementById(id); }
  function num(day) { return R.diffDays(DAY1, day) + 1; }
  function pickIndex(n, len) {
    var steps = [37, 41, 43, 47, 53], step = 1;
    for (var i = 0; i < steps.length; i++) { if (gcd(steps[i], len) === 1) { step = steps[i]; break; } }
    return ((n * step + 11) % len + len) % len;
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function cho(s) {
    return String(s).split('').map(function (ch) {
      var c = ch.charCodeAt(0) - 0xAC00;
      return c >= 0 && c < 11172 ? CHO.charAt(Math.floor(c / 588)) : ch;
    }).join('');
  }
  function fmt(v) {
    var s = String(v), parts = s.split('.');
    parts[0] = parts[0].replace(/[0-9](?=([0-9]{3})+$)/g, function (m) { return m + ','; });
    return parts.join('.');
  }

  function load() {
    var day = today();
    return Promise.all([S.getAll('content', 'kind', 'disease'), S.getAll('content', 'kind', 'stat'), S.get('meta', 'daily')]).then(function (res) {
      var dz = res[0].map(function (r) { return r.data; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var byName = {};
      dz.forEach(function (d) { if (!byName[d.name]) { byName[d.name] = d; } });
      var pool = dz.filter(function (d) { return (d.tier === 'S' || d.tier === 'A') && d.tests.length && d.treatments.length; });
      var stats = res[1].map(function (r) { return r.data; }).filter(function (s) { return typeof s.value === 'number'; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var st = res[2] || { key: 'daily', stats: {} };
      st.stats = st.stats || {};
      ['dx', 'num'].forEach(function (k) {
        if (!st[k] || st[k].date !== day) { st[k] = { date: day, guesses: [], done: false, win: false }; }
        st.stats[k] = st.stats[k] || { played: 0, wins: 0, cur: 0, best: 0, last: '', dist: [0, 0, 0, 0, 0, 0] };
      });
      var n = num(day);
      st.practice = st.practice || {};
      cache = {
        pool: pool, stats: stats, cur: null,
        day: day, n: n, dz: dz, byName: byName, st: st,
        dxAns: pool.length ? pool[pickIndex(n, pool.length)] : null,
        numAns: stats.length ? stats[pickIndex(n + 7, stats.length)] : null
      };
      return cache;
    });
  }
  function save() { return S.putMany('meta', [cache.st]); }

  /* ---------- 채점 ---------- */
  function cmpSet(a, b) {
    var inter = a.filter(function (x) { return b.indexOf(x) >= 0; });
    var same = inter.length === a.length && a.length === b.length;
    return { c: same ? 'g' : (inter.length ? 'y' : 'n'), shared: inter };
  }
  function grade(g, ans) {
    var wk = { c: 'n', t: g.week ? 'W' + g.week : '확장', arrow: '' };
    if (g.week === ans.week) { wk.c = 'g'; }
    else if (g.week && ans.week) { wk.c = Math.abs(g.week - ans.week) <= 2 ? 'y' : 'n'; wk.arrow = ans.week > g.week ? '↑' : '↓'; }
    var ln = cmpSet(g.lenses, ans.lenses), ts = cmpSet(g.tests, ans.tests), tx = cmpSet(g.treatments, ans.treatments);
    return [
      { c: g.id === ans.id ? 'g' : 'n', t: g.name, k: 'name' },
      { c: g.system === ans.system ? 'g' : 'n', t: g.system },
      wk,
      { c: ln.c, t: g.lenses.join('·') || '—' },
      { c: ts.c, t: ts.shared[0] || g.tests[0] || '—' },
      { c: tx.c, t: tx.shared[0] || g.treatments[0] || '—' }
    ];
  }
  function numGrade(v, ans) {
    var err = Math.abs(v - ans) / Math.abs(ans || 1);
    return { c: err <= 0.05 ? 'g' : (err <= 0.25 ? 'y' : 'n'), arrow: ans > v ? '↑' : (ans < v ? '↓' : ''), err: err };
  }

  /* ---------- 오늘의 진단 ---------- */
  function rowHtml(cells) {
    return `<div class='dx-row'>` + cells.map(function (c, i) {
      return `<div class='dx-c ${c.c}${i === 0 ? ' nm' : ''}' style='--d:${i * 70}ms'><span>${esc(c.t)}</span>${c.arrow ? `<b>${c.arrow}</b>` : ''}</div>`;
    }).join('') + `</div>`;
  }
  function target(kind, practice) {
    var c = cache;
    if (!practice) { return { s: c.st[kind], ans: kind === 'dx' ? c.dxAns : c.numAns }; }
    var p = c.st.practice[kind];
    if (!p) { return { s: null, ans: null }; }
    var ans = kind === 'dx' ? c.dz.filter(function (d) { return d.id === p.ansId; })[0] : c.stats.filter(function (x) { return x.id === p.ansId; })[0];
    return { s: p, ans: ans || null };
  }
  function title(kind, practice) {
    var c = cache, name = kind === 'dx' ? '오늘의 진단' : '오늘의 숫자';
    return practice ? name + ` <span class='pill blue'>연습 ${c.st.practice[kind] ? c.st.practice[kind].n : ''}</span>` : name + ` <span class='num'>#${c.n}</span>`;
  }
  function dxScreen(practice) {
    return load().then(function () {
      if (practice && !cache.st.practice.dx) { return newPractice('dx', true).then(function () { return dxScreen(true); }); }
      var c = cache, tg = target('dx', practice), s = tg.s, ans = tg.ans;
      c.cur = { kind: 'dx', practice: !!practice };
      var back = `<a class='back' href='#/today'>‹ 홈</a>`;
      if (!ans) { return back + A().emptyCard('퍼즐 재료가 없어요', '기본 콘텐츠를 받으면 오늘의 진단이 열립니다.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`); }
      var rows = s.guesses.map(function (id) { var g = c.dz.filter(function (d) { return d.id === id; })[0]; return g ? rowHtml(grade(g, ans)) : ''; }).join('');
      for (var i = s.guesses.length; i < TRIES; i++) { rows += `<div class='dx-row empty'>${new Array(7).join(`<div class='dx-c'></div>`)}</div>`; }
      var misses = s.guesses.length - (s.win ? 1 : 0);
      var hint = !s.done && misses >= 3 ? `<p class='pz-hint'>💡 초성 힌트: <b>${esc(cho(ans.name))}</b></p>` : '';
      var input = s.done ? '' : `<div class='pz-input' id='pz-input'><input id='dx-in' list='dx-list' autocomplete='off' placeholder='질환 이름 (예: 당뇨병)' aria-label='질환 이름'>` +
        `<button type='button' class='btn' data-action='dx-guess'>확인</button></div><datalist id='dx-list'>${c.dz.map(function (d) { return `<option value='${esc(d.name)}'>`; }).join('')}</datalist>` +
        `<p class='pz-msg' id='pz-msg' aria-live='polite'>${TRIES - s.guesses.length}번 남았어요.</p>`;
      return back + `<div class='pz-head'><h1 class='large-title'>${title('dx', practice)}</h1><p>${practice ? '연습 문제는 몇 번이든 풀 수 있어요.' : '오늘의 질환을 6번 안에 맞히세요.'} 🟩 같음 · 🟨 일부 같음 · ⬜ 다름 · 주차 ↑↓는 정답이 더 뒤·앞</p></div>` +
        `<div class='dx-board'><div class='dx-row hd'><div>질환</div><div>계통</div><div>주차</div><div>렌즈</div><div>검사</div><div>치료</div></div>${rows}</div>` +
        hint + input + (s.done ? doneHtml('dx', practice) : '');
    });
  }
  function dxGuess() {
    if (busy || !cache || !cache.cur) { return; }
    var inp = el('dx-in'), v = inp ? String(inp.value || '').trim() : '';
    var tg = target('dx', cache.cur.practice), s = tg.s, ans = tg.ans;
    var g = cache.byName[v];
    if (!g) {
      var lower = v.toLowerCase();
      g = cache.dz.filter(function (d) { return d.name.toLowerCase() === lower || d.full === v; })[0];
    }
    if (!g) { shake('목록에 있는 질환 이름을 골라 주세요.'); return; }
    if (s.guesses.indexOf(g.id) >= 0) { shake('이미 넣어 본 질환이에요.'); return; }
    s.guesses.push(g.id);
    var win = g.id === ans.id;
    G.sfx(win ? 'easy' : 'flip', A().settings().sound !== false);
    if (win || s.guesses.length >= TRIES) { finish('dx', win, cache.cur.practice); return; }
    save().then(function () { A().refresh(); });
  }

  /* ---------- 오늘의 숫자 ---------- */
  function numScreen(practice) {
    return load().then(function () {
      if (practice && !cache.st.practice.num) { return newPractice('num', true).then(function () { return numScreen(true); }); }
      var c = cache, tg = target('num', practice), s = tg.s, ans = tg.ans;
      c.cur = { kind: 'num', practice: !!practice };
      var back = `<a class='back' href='#/today'>‹ 홈</a>`;
      if (!ans) { return back + A().emptyCard('퍼즐 재료가 없어요', '통계 레지스트리를 받으면 오늘의 숫자가 열립니다.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`); }
      var rows = s.guesses.map(function (v) {
        var r = numGrade(v, ans.value);
        return `<div class='nm-row ${r.c}'><b class='num'>${esc(fmt(v))}</b><span>${esc(ans.unit || '')}</span><i>${r.arrow}</i><em class='num'>${r.err <= 0.05 ? '정답 범위' : Math.round(r.err * 100) + '% 차이'}</em></div>`;
      }).join('');
      for (var i = s.guesses.length; i < TRIES; i++) { rows += `<div class='nm-row empty'></div>`; }
      var misses = s.guesses.length - (s.win ? 1 : 0);
      var digits = String(Math.floor(Math.abs(ans.value))).length;
      var hint = !s.done && misses >= 3 ? `<p class='pz-hint'>💡 힌트: 정수 부분이 <b>${digits}자리</b> 수예요.</p>` : '';
      var input = s.done ? '' : `<div class='pz-input' id='pz-input'><input id='num-in' inputmode='decimal' autocomplete='off' placeholder='숫자 (${esc(ans.unit || '')})' aria-label='숫자'>` +
        `<button type='button' class='btn' data-action='num-guess'>확인</button></div><p class='pz-msg' id='pz-msg' aria-live='polite'>±5% 안이면 정답 · ${TRIES - s.guesses.length}번 남았어요.</p>`;
      return back + `<div class='pz-head'><h1 class='large-title'>${title('num', practice)}</h1><p>기자는 숫자 감각으로 오보를 막습니다.${practice ? ' 연습은 몇 번이든 돼요.' : ''}</p></div>` +
        `<div class='card nm-q'><span class='kicker'>${esc(ans.period || '')} · ${esc(ans.population || '')}</span><h2>${esc(ans.label)}</h2><p class='note'>단위: ${esc(ans.unit || '')}${ans.needsVerification ? ' · 원자료 확인 필요' : ''}</p></div>` +
        `<div class='nm-board'>${rows}</div>` + hint + input + (s.done ? doneHtml('num', practice) : '');
    });
  }
  function numGuess() {
    if (busy || !cache || !cache.cur) { return; }
    var inp = el('num-in');
    var raw = inp ? String(inp.value || '').split(',').join('').split(' ').join('') : '';
    var v = Number(raw);
    if (!raw || isNaN(v)) { shake('숫자를 넣어 주세요.'); return; }
    var tg = target('num', cache.cur.practice), s = tg.s, ans = tg.ans;
    s.guesses.push(v);
    var win = numGrade(v, ans.value).c === 'g';
    G.sfx(win ? 'easy' : 'flip', A().settings().sound !== false);
    if (win || s.guesses.length >= TRIES) { finish('num', win, cache.cur.practice); return; }
    save().then(function () { A().refresh(); });
  }

  /* ---------- 끝·공유·통계 ---------- */
  function finish(kind, win, practice) {
    busy = true;
    var c = cache, tg = target(kind, practice), s = tg.s;
    s.done = true; s.win = win;
    if (!practice) {
      var t = c.st.stats[kind];
      t.played += 1;
      if (win) {
        t.wins += 1;
        t.cur = t.last === R.addDays(c.day, -1) ? t.cur + 1 : 1;
        t.best = Math.max(t.best, t.cur);
        t.dist[s.guesses.length - 1] += 1;
      } else { t.cur = 0; }
      t.last = win ? c.day : t.last;
    } else {
      c.st.practiceDone = (c.st.practiceDone || 0) + 1;
    }
    var id = tg.ans.id, wasNew = false;
    save().then(function () { return G.loadDiscover(); }).then(function (d) { wasNew = !d[kind][id]; return G.discover(kind, id); }).then(function () { return PHD.play.status(); }).then(function (st) {
      if (practice) { return G.addXp(c.day, win ? 3 : 1, wasNew ? 'disc' : null, st.q); }
      return G.addXp(c.day, win ? 5 : 2, 'puzzles', st.q);
    }).then(function (out) {
      busy = false;
      c.lastOut = out;
      c.lastNew = wasNew;
      G.sfx(win ? 'level' : 'done', A().settings().sound !== false);
      A().refresh();
    }).catch(function (e) { busy = false; A().toast('저장하지 못했습니다: ' + (e && e.message ? e.message : e)); });
  }
  // 연습 문제: 아직 발견하지 못한 것부터, 오늘의 문제는 빼고.
  function newPractice(kind, silent) {
    var c = cache;
    return G.loadDiscover().then(function (d) {
      var list = kind === 'dx' ? c.pool : c.stats;
      var skip = kind === 'dx' ? (c.dxAns && c.dxAns.id) : (c.numAns && c.numAns.id);
      var prev = c.st.practice[kind] && c.st.practice[kind].ansId;
      var cand = list.filter(function (x) { return x.id !== skip && x.id !== prev && !d[kind][x.id]; });
      if (!cand.length) { cand = list.filter(function (x) { return x.id !== skip && x.id !== prev; }); }
      if (!cand.length) { cand = list; }
      var ans = cand[Math.floor(Math.random() * cand.length)];
      var n = (c.st.practiceCount || 0) + 1;
      c.st.practiceCount = n;
      c.st.practice[kind] = { ansId: ans.id, guesses: [], done: false, win: false, n: n };
      return save();
    }).then(function () { if (!silent) { location.hash = '#/puzzle/' + kind + 'p'; A().refresh(); } });
  }
  function more(kind) { if (!cache) { return Promise.resolve(); } return newPractice(kind, false); }
  function shareText(kind) {
    var c = cache, s = c.st[kind];
    var head = '진우주 기자 학교 · ' + (kind === 'dx' ? '오늘의 진단' : '오늘의 숫자') + ' #' + c.n + ' ' + (s.win ? s.guesses.length : 'X') + '/' + TRIES;
    var lines = s.guesses.map(function (g) {
      if (kind === 'dx') { var d = c.dz.filter(function (x) { return x.id === g; })[0]; return grade(d, c.dxAns).map(function (x) { return EMO[x.c]; }).join(''); }
      var r = numGrade(g, c.numAns.value); return EMO[r.c] + (r.arrow === '↑' ? '⬆️' : (r.arrow === '↓' ? '⬇️' : '🎯'));
    });
    return [head].concat(lines).join(String.fromCharCode(10));
  }
  function doneHtml(kind, practice) {
    var c = cache, tg = target(kind, practice), s = tg.s, t = c.st.stats[kind], out = c.lastOut;
    var answer;
    if (kind === 'dx') {
      var a = tg.ans;
      answer = `<h2>${esc(a.name)}</h2><p class='disc-def'>계통 <b>${esc(a.system)}</b> · ${a.week ? 'W' + a.week : '확장'} · 렌즈 ${esc(a.lenses.join('·') || '—')}</p>` +
        `<p class='disc-def'>검사: ${esc(a.tests.join(', '))}<br>치료: ${esc(a.treatments.join(', '))}</p>` +
        (a.confusable.length ? `<p class='disc-note'><b>헷갈리는 병</b> ${esc(a.confusable.join(', '))}</p>` : '');
    } else {
      var n = tg.ans;
      answer = `<h2 class='num'>${esc(fmt(n.value))} <small>${esc(n.unit || '')}</small></h2><p class='disc-def'>${esc(n.label)} · ${esc(n.period || '')}</p>` +
        (n.definition ? `<p class='disc-note'><b>정의</b> ${esc(n.definition)}</p>` : '') +
        (n.note ? `<p class='disc-def'>${esc(n.note)}</p>` : '') + `<p class='note'>공표 ${esc(n.publishedAt || '')}${n.reviewBy ? ' · 재검토 ' + esc(n.reviewBy) : ''}${n.needsVerification ? ' · 원자료 확인 필요' : ''}</p>`;
    }
    var max = Math.max.apply(null, [1].concat(t.dist));
    var dist = t.dist.map(function (v, i) {
      var me = s.win && s.guesses.length === i + 1;
      return `<div class='dist-r'><span>${i + 1}</span><i class='${me ? 'me' : ''}' style='width:${Math.max(8, Math.round(100 * v / max))}%'>${v}</i></div>`;
    }).join('');
    var head = `<div class='card pz-done ${s.win ? 'win' : 'lose'}'><span class='disc-k'>${s.win ? '정답! ' + s.guesses.length + '/6' : '이번엔 여기까지 — 정답은'}</span>${answer}` +
      `<p class='disc-xp'>${out ? '+' + out.gained + ' XP · ' : ''}카드가 취재 덱에 들어갔어요</p>` +
      `<div class='btn-row'><button type='button' class='btn' data-action='pz-more' data-kind='${kind}'>한 문제 더</button>` +
      (practice ? `<a class='btn secondary' href='#/today'>홈으로</a>` : `<button type='button' class='btn secondary' data-action='pz-share' data-kind='${kind}'>결과 복사</button>`) + `</div></div>`;
    if (practice) { return head + `<p class='footnote'>연습 문제는 출석·기록과 상관없이 계속 풀 수 있어요. 아직 발견하지 못한 것부터 나옵니다.</p>`; }
    return head +
      `<div class='section-title'>오늘의 문제 기록</div><div class='card'><div class='pz-stats'><div><b class='num'>${t.played}</b><span>푼 날</span></div><div><b class='num'>${t.played ? Math.round(100 * t.wins / t.played) : 0}%</b><span>정답률</span></div><div><b class='num'>${t.cur}</b><span>연속</span></div><div><b class='num'>${t.best}</b><span>최고 연속</span></div></div><div class='dist'>${dist}</div></div>` +
      `<p class='footnote'>오늘의 문제는 내일 새로 열립니다. ‘한 문제 더’로 지금 계속 풀 수 있어요. 감수 전 자료로 만든 퍼즐이에요.</p>`;
  }
  function share(kind) {
    var text = shareText(kind);
    var ok = function () { A().toast('결과를 복사했어요.'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, function () { fallback(text); ok(); }); return; }
    } catch (e) { /* 아래로 */ }
    fallback(text); ok();
  }
  function fallback(text) {
    var t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* 무시 */ }
    t.remove();
  }
  function shake(msg) {
    var b = el('pz-input'), m = el('pz-msg');
    if (m) { m.textContent = msg; }
    if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    G.sfx('again', A().settings().sound !== false);
  }

  function status() {
    return load().then(function (c) {
      function one(k) { var s = c.st[k]; return { done: s.done, win: s.win, tries: s.guesses.length, ready: !!(k === 'dx' ? c.dxAns : c.numAns) }; }
      return { n: c.n, dx: one('dx'), num: one('num') };
    });
  }

  PHD.daily = { dxScreen: dxScreen, numScreen: numScreen, dxGuess: dxGuess, numGuess: numGuess, share: share, status: status, shareText: shareText, cho: cho, more: more };
})();
