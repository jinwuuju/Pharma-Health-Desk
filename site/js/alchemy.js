/* 진우주 기자 학교 — 인체 연금술(Little Alchemy 2형, D019).
   기본 원소 6개에서 시작해 두 개를 차례로 눌러 섞으면 장기·계통·질환·치료가 ‘발견’된다. 발견하면 카드가 취재 덱에 들어간다. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, G = PHD.game;
  var esc = U.esc;
  var ui = { slots: [null, null], hint: null, hintStep: 0, fresh: {}, busy: false };
  var data = null;
  var FAILS = ['아무 일도 일어나지 않았어요.', '섞이지 않네요. 다른 조합은?', '반응 없음 — 기자는 다시 묻습니다.', '흠, 이 둘은 서로 모르는 사이예요.'];

  function A() { return PHD.app; }
  function today() { return U.studyDate(A().settings().dayStartHour); }
  function el(id) { return document.getElementById(id); }

  function loadData() {
    return Promise.all([S.getAll('content', 'kind', 'element'), S.getAll('content', 'kind', 'recipe'), G.loadDiscover()]).then(function (res) {
      var els = res[0].map(function (r) { return r.data; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var byId = {}, recipes = {}, uses = {};
      els.forEach(function (e) { byId[e.id] = e; uses[e.id] = []; });
      res[1].forEach(function (r) {
        var d = r.data;
        if (!byId[d.a] || !byId[d.b] || !byId[d.result]) { return; }
        recipes[[d.a, d.b].sort().join('+')] = d.result;
        uses[d.a].push(d); if (d.b !== d.a) { uses[d.b].push(d); }
      });
      data = { els: els, byId: byId, recipes: recipes, uses: uses, disc: res[2] };
      return data;
    });
  }
  function known(id) { var e = data.byId[id]; return !!e && (e.base || !!data.disc.al[id]); }
  function spent(id) { return data.uses[id].length > 0 && data.uses[id].every(function (r) { return known(r.result); }); }
  function icon(e, big) {
    if (e.icon) { return `<i class='ic${big ? ' big' : ''}'>${esc(e.icon)}</i>`; }
    return `<i class='ic mono${big ? ' big' : ''}'>${esc(String(e.name).charAt(0))}</i>`;
  }
  function makeable() {
    var out = [];
    Object.keys(data.recipes).forEach(function (k) {
      var parts = k.split('+'), res = data.recipes[k];
      if (known(parts[0]) && known(parts[1]) && !known(res)) { out.push({ a: parts[0], b: parts[1], result: res }); }
    });
    return out;
  }

  /* ---------- 화면 ---------- */
  function screen() {
    return loadData().then(function () {
      if (!data.els.length) {
        return `<h1 class='large-title'>발견</h1>` + A().emptyCard('연금술 재료가 아직 없어요', '기본 콘텐츠를 받으면 세포·혈액·공기·음식·신호·시간 6가지 원소로 시작합니다.', `<button type='button' class='btn' data-action='load-builtin'>기본 콘텐츠 받기</button>`);
      }
      var total = data.els.length;
      var found = data.els.filter(function (e) { return known(e.id); }).length;
      var grid = data.els.filter(function (e) { return known(e.id); }).map(function (e) {
        var cls = 'el' + (spent(e.id) ? ' spent' : '') + (ui.fresh[e.id] ? ' fresh' : '') + (ui.hint && ui.hintStep >= 1 && (ui.hint.a === e.id || (ui.hintStep >= 2 && ui.hint.b === e.id)) ? ' hint' : '');
        return `<button type='button' class='${cls}' data-action='al-pick' data-id='${esc(e.id)}'>${icon(e)}<span>${esc(e.name)}</span></button>`;
      }).join('');
      return `<div class='al-top'><h1 class='large-title'>인체 연금술</h1><button type='button' class='chip hint-btn' data-action='al-hint'>💡 힌트</button></div>` +
        `<div class='al-count'><b class='num'>${found}</b><span>/ ${total} 발견</span><div class='xpbar'><i style='width:${Math.round(100 * found / total)}%'></i></div></div>` +
        `<div class='bench' id='al-bench'>${slotHtml(0)}<span class='op'>+</span>${slotHtml(1)}<span class='op'>=</span><button type='button' class='slot result' id='al-result' data-action='al-info' aria-label='결과'><i class='ic q'>?</i></button></div>` +
        `<p class='al-msg' id='al-msg' aria-live='polite'>${esc(msgDefault(found, total))}</p>` +
        `<div class='al-grid'>${grid}</div>` +
        `<p class='footnote'>흐릿한 원소는 더 만들 것이 없는 원소예요. 발견한 것은 카드가 되어 취재에서 다시 만납니다.</p>`;
    });
  }
  function msgDefault(found, total) {
    if (found >= total) { return '모두 발견했어요! 인체 지도가 완성됐습니다.'; }
    return ui.hint ? hintText() : '두 원소를 차례로 눌러 섞어 보세요.';
  }
  function slotHtml(i) {
    var id = ui.slots[i];
    if (!id) { return `<button type='button' class='slot empty' data-action='al-slot' data-i='${i}' aria-label='빈 칸'><i class='ic q'>+</i></button>`; }
    var e = data.byId[id];
    return `<button type='button' class='slot filled' data-action='al-slot' data-i='${i}' aria-label='${esc(e.name)} 빼기'>${icon(e)}<span>${esc(e.name)}</span></button>`;
  }
  function paintBench() {
    var b = el('al-bench');
    if (!b) { return; }
    var r = el('al-result');
    var keep = r ? r.outerHTML : '';
    b.innerHTML = slotHtml(0) + `<span class='op'>+</span>` + slotHtml(1) + `<span class='op'>=</span>` + keep;
  }
  function setMsg(t) { var m = el('al-msg'); if (m) { m.textContent = t; } }
  function setResult(e, cls) {
    var r = el('al-result');
    if (!r) { return; }
    r.className = 'slot result ' + (cls || '');
    r.setAttribute('data-id', e ? e.id : '');
    r.innerHTML = e ? icon(e) + `<span>${esc(e.name)}</span>` : `<i class='ic q'>?</i>`;
  }

  /* ---------- 동작 ---------- */
  function pick(id) {
    if (!data || ui.busy || !known(id)) { return; }
    var i = ui.slots[0] ? (ui.slots[1] ? -1 : 1) : 0;
    if (i < 0) { ui.slots = [id, null]; i = 0; }
    ui.slots[i] = id;
    G.sfx('flip', A().settings().sound !== false);
    setResult(null);
    paintBench();
    if (ui.slots[0] && ui.slots[1]) { combine(); }
  }
  function clearSlot(i) { ui.slots[Number(i) || 0] = null; paintBench(); }

  function combine() {
    var a = ui.slots[0], b = ui.slots[1];
    var res = data.recipes[[a, b].sort().join('+')];
    var sound = A().settings().sound !== false;
    ui.busy = true;
    if (!res) {
      G.sfx('again', sound);
      var bench = el('al-bench');
      if (bench) { bench.classList.remove('shake'); void bench.offsetWidth; bench.classList.add('shake'); }
      setMsg(FAILS[Math.floor(Math.random() * FAILS.length)]);
      setTimeout(function () { ui.slots = [null, null]; ui.busy = false; paintBench(); }, 650);
      return;
    }
    var e = data.byId[res];
    if (known(res)) {
      G.sfx('good', sound);
      setResult(e, 'known');
      setMsg('이미 발견한 ‘' + e.name + '’예요.');
      setTimeout(function () { ui.slots = [null, null]; ui.busy = false; paintBench(); }, 700);
      return;
    }
    G.discover('al', res).then(function (r) {
      data.disc = r.all;
      ui.fresh[res] = true;
      if (ui.hint && ui.hint.result === res) { ui.hint = null; ui.hintStep = 0; }
      setResult(e, 'new');
      G.sfx('level', sound);
      G.haptic(15);
      return PHD.play.status().then(function (st) { return G.addXp(today(), G.XP.fresh, 'disc', st.q); });
    }).then(function (out) {
      ui.slots = [null, null];
      ui.busy = false;
      showDiscovery(e, out);
    }).catch(function (err) { ui.busy = false; A().toast('저장하지 못했습니다: ' + (err && err.message ? err.message : err)); });
  }

  function showDiscovery(e, out) {
    var total = data.els.length, found = data.els.filter(function (x) { return known(x.id); }).length;
    var up = out && out.after && out.before && out.after.level > out.before.level;
    A().openSheet(`<div class='grab'></div><div class='disc'>` +
      `<span class='disc-k'>새 발견! · ${found}/${total}</span><div class='disc-ic'>${icon(e, true)}</div><h2>${esc(e.name)}</h2>` +
      `<p class='disc-def'>${esc(e.def)}</p>` + (e.note ? `<p class='disc-note'><b>기자 포인트</b> ${esc(e.note)}</p>` : '') +
      `<p class='disc-xp'>+${out ? out.gained : 2} XP · 카드가 취재 덱에 들어갔어요${out && out.streakUp ? ' · 🔥 연속 ' + out.game.streak + '일' : ''}${out && out.bonusXp ? ' · 퀘스트 달성 +' + out.bonusXp : ''}</p>` +
      (up ? `<p class='disc-up'>레벨 업! Lv ${out.after.level} · ${esc(out.after.rank)}</p>` : '') +
      `<div class='btn-row'><button type='button' class='btn' data-action='al-continue'>계속 섞기</button></div></div>`);
    if (found >= total) { G.sfx('done', A().settings().sound !== false); }
  }

  function info(id) {
    var e = data && data.byId[id];
    if (!e) { return; }
    A().openSheet(`<div class='grab'></div><div class='disc'><div class='disc-ic'>${icon(e, true)}</div><h2>${esc(e.name)}</h2><p class='disc-def'>${esc(e.def)}</p>` +
      (e.note ? `<p class='disc-note'><b>기자 포인트</b> ${esc(e.note)}</p>` : '') + `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>닫기</button></div></div>`);
  }

  function hintText() {
    if (!ui.hint) { return ''; }
    var a = data.byId[ui.hint.a], b = data.byId[ui.hint.b], r = data.byId[ui.hint.result];
    var blanks = new Array(String(r.name).length + 1).join('○');
    if (ui.hintStep >= 2) { return '💡 ' + a.name + ' + ' + b.name + ' = ' + blanks; }
    return '💡 ‘' + a.name + '’에 무언가를 섞으면 ' + blanks + '(' + String(r.name).length + '글자)이 나와요.';
  }
  function hint() {
    if (!data) { return; }
    var list = makeable();
    if (!list.length) { setMsg('지금 만들 수 있는 새 원소가 없어요. 모두 발견했나요?'); return; }
    if (!ui.hint || !list.some(function (x) { return x.result === ui.hint.result; })) {
      ui.hint = list[Math.floor(Math.random() * list.length)];
      ui.hintStep = 1;
    } else if (ui.hintStep < 2) {
      ui.hintStep = 2;
    }
    A().refresh();
  }

  PHD.alchemy = {
    screen: screen, pick: pick, clearSlot: clearSlot, hint: hint, info: function (id) { info(id); },
    after: function () { A().closeSheet(); A().refresh(); },
    stats: function () { return loadData().then(function () { return { found: data.els.filter(function (e) { return known(e.id); }).length, total: data.els.length, makeable: makeable().length }; }); }
  };
})();
