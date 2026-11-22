/* 진우주 기자 학교 — 오보찾기 문제 은행 엔진(D021). 게임 5종(지뢰찾기·퀴즈쇼·속보 러시·짝 맞추기·스네이크)이 같은 문항을 쓴다.
   고르는 규칙: 처음 보는 문항 → 틀렸던 문항 → 오래 안 본 문항. 선지는 매번 섞는다. 해설은 선지마다 왜 맞고 틀린지 + 고쳐 쓰기 + 기자 체크. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, G = PHD.game;
  var esc = U.esc;
  var CATS = { design: '연구 설계', number: '숫자·통계', trial: '임상·신약', reg: '허가·제도', term: '의학 용어', ethics: '표현·윤리', source: '출처·시점' };
  var LETTERS = ['A', 'B', 'C', 'D'];
  var bank = [], byId = {}, st = null, seenNow = {}, handler = null;

  function load() {
    return Promise.all([S.getAll('content', 'kind', 'trap'), S.get('meta', 'quiz')]).then(function (res) {
      bank = res[0].map(function (r) { return r.data; }).filter(function (d) { return Array.isArray(d.choices) && d.choices.length >= 3; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      byId = {};
      bank.forEach(function (d) { byId[d.id] = d; });
      st = res[1] || {};
      st.key = 'quiz'; st.items = st.items || {}; st.best = st.best || {}; st.wrong = st.wrong || []; st.plays = st.plays || {};
      return bank;
    });
  }
  function save() { return S.putMany('meta', [st]); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function order(item) { return shuffle(item.choices.map(function (c, i) { return i; })); }

  function weight(item, lv) {
    var s = st.items[item.id], w = Math.random();
    if (!s) { w += 3; }
    else {
      if (s.wrong > s.right) { w += 2; }
      w += Math.min(2, (Date.now() - (s.last || 0)) / 86400000 / 3);
    }
    if (lv && item.lv === lv) { w += 2.5; }
    if (seenNow[item.id]) { w -= 6; }
    return w;
  }
  function pick(n, opts) {
    opts = opts || {};
    var list = bank.filter(function (x) { return !(opts.exclude && opts.exclude[x.id]) && (!opts.filter || opts.filter(x)); });
    var out = list.map(function (x) { return { x: x, w: weight(x, opts.lv) }; }).sort(function (a, b) { return b.w - a.w; }).slice(0, n).map(function (o) { return o.x; });
    out.forEach(function (x) { seenNow[x.id] = true; });
    return out;
  }
  // O/X 문장: 문제 문장(오보)·고쳐 쓴 문장(정확)·추가 문장. 정확/오보를 거의 반반으로.
  function statements(n) {
    var items = pick(Math.max(4, Math.ceil(n * 0.8)));
    var pool = [];
    items.forEach(function (it) { (it.ox || []).forEach(function (o) { pool.push({ t: o.t, a: !!o.a, why: o.why, id: it.id }); }); });
    pool = shuffle(pool);
    var yes = pool.filter(function (p) { return p.a; }), no = pool.filter(function (p) { return !p.a; }), out = [];
    while (out.length < n && (yes.length || no.length)) {
      var takeYes = yes.length && (!no.length || Math.random() < 0.5);
      out.push(takeYes ? yes.shift() : no.shift());
    }
    return out;
  }

  // 기록: 문항별 맞힘·틀림, 오답 노트, 발견(카드 열림: 함정 tr + 근거 사다리 ev).
  function record(id, ok) {
    var it = byId[id];
    if (!it) { return Promise.resolve({ isNew: false }); }
    var s = st.items[id] || { seen: 0, right: 0, wrong: 0, last: 0 };
    s.seen += 1; s.last = Date.now();
    if (ok) { s.right += 1; } else { s.wrong += 1; }
    st.items[id] = s;
    st.wrong = st.wrong.filter(function (x) { return x !== id; });
    if (!ok) { st.wrong.unshift(id); st.wrong = st.wrong.slice(0, 60); }
    var isNew = false;
    return save().then(function () { return G.discover('tr', id); }).then(function (r) {
      isNew = r.isNew;
      return it.evidenceId ? G.discover('ev', it.evidenceId) : null;
    }).then(function () { return { isNew: isNew }; });
  }
  function recordMany(list) {
    var news = 0;
    return list.reduce(function (p, r) { return p.then(function () { return record(r.id, r.ok).then(function (x) { if (x.isNew) { news += 1; } }); }); }, Promise.resolve()).then(function () { return news; });
  }
  function setBest(game, score, lowerIsBetter) {
    var prev = st.best[game];
    var better = prev == null || (lowerIsBetter ? score < prev : score > prev);
    if (better) { st.best[game] = score; }
    st.plays[game] = (st.plays[game] || 0) + 1;
    return save().then(function () { return better; });
  }
  // 게임 끝 XP: 맞힌 수 + 새로 알게 된 문항(새 발견) + 보너스.
  function award(xp, news) {
    var day = U.studyDate(PHD.app.settings().dayStartHour);
    return PHD.play.status().then(function (s) { return G.addXp(day, xp, news ? 'disc' : null, s.q, news); });
  }

  /* ---------- 그리기 ---------- */
  function dots(lv) { var o = ''; for (var i = 1; i <= 3; i++) { o += i <= (lv || 1) ? '●' : '○'; } return o; }
  function questionHtml(item, ord, opts) {
    opts = opts || {};
    return `<div class='qz'><span class='qz-cat'>${esc(item.catName || CATS[item.cat] || '')} · 난도 ${dots(item.lv)}</span>` +
      `<blockquote class='trap-head'>${esc(item.headline)}</blockquote><p class='trap-q'>${esc(item.q || '이 문장의 가장 큰 문제는?')}</p>` +
      `<div class='qz-choices'>${ord.map(function (k, i) {
        var hide = opts.hidden && opts.hidden[k], sel = opts.selected === k;
        return `<button type='button' class='tc${sel ? ' sel' : ''}${hide ? ' gone' : ''}' data-action='qz-pick' data-k='${k}'${hide ? ' disabled' : ''}><b>${LETTERS[i]}</b><span>${esc(item.choices[k].t)}</span></button>`;
      }).join('')}</div></div>`;
  }
  function explainHtml(item, ord, picked, opts) {
    opts = opts || {};
    var ok = picked === item.answer;
    return `<div class='qz-ex'>${opts.noVerdict ? '' : `<span class='trap-k ${ok ? 'ok' : 'bad'}'>${ok ? '✓ 정답' : '✕ 오답'}${opts.extra ? ' · ' + esc(opts.extra) : ''}</span>`}` +
      `<h2>${esc(item.icon || '')} ${esc(item.title)}</h2>` +
      `<ul class='ex-list'>${ord.map(function (k, i) {
        var right = k === item.answer, mine = k === picked;
        return `<li class='${right ? 'right' : ''}${mine && !right ? ' picked' : ''}'><b>${LETTERS[i]} ${right ? '✓' : '✗'}</b><span>${esc(item.choices[k].t)}</span><em>${esc(item.choices[k].why)}</em></li>`;
      }).join('')}</ul>` +
      `<div class='ex-fix'><b>고쳐 쓰면</b>${esc(item.fix)}</div><div class='disc-note'><b>기자 체크</b> ${esc(item.tip)}</div>` +
      (item.level ? `<p class='note'>근거 사다리 ${item.level}단계 카드와 함께 열려요.</p>` : '') + `</div>`;
  }
  function oxNoteHtml(list) {
    if (!list.length) { return ''; }
    return `<div class='section-title'>오답 노트</div><div class='list notes'>` + list.map(function (s) {
      var it = byId[s.id];
      return `<button type='button' class='row' data-action='note-open' data-id='${esc(s.id)}'><div class='tx'><span class='ox-tag ${s.a ? 'o' : 'x'}'>${s.a ? '정확' : '오보'}</span> ${esc(s.t)}<span class='sub'>${esc(s.why)}</span></div><span class='chev'>›</span></button>`;
    }).join('') + `</div>`;
  }
  function openNote(id) {
    var it = byId[id];
    if (!it) { return; }
    var ord = it.choices.map(function (c, i) { return i; });
    PHD.app.openSheet(`<div class='grab'></div>` + explainHtml(it, ord, it.answer, { noVerdict: true }) + `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>닫기</button></div>`);
  }

  function ask(fn) { handler = fn; }
  function choose(k) { if (handler) { handler(Number(k)); } }

  PHD.quiz = {
    CATS: CATS, LETTERS: LETTERS, load: load, pick: pick, statements: statements, order: order, shuffle: shuffle,
    record: record, recordMany: recordMany, setBest: setBest, award: award,
    questionHtml: questionHtml, explainHtml: explainHtml, oxNoteHtml: oxNoteHtml, openNote: openNote, ask: ask, choose: choose,
    bank: function () { return bank; }, item: function (id) { return byId[id]; }, state: function () { return st; },
    resetSession: function () { seenNow = {}; }
  };
})();
