/* 기자 데스크 — 화면(M1 앱 골격). 데이터 변경은 store·packs 모듈을 통해서만 한다. */
(function () {
  'use strict';
  var PHD = window.PHD;
  var U = PHD.util, S = PHD.store, P = PHD.packs;
  var esc = U.esc;
  var APP_STEP = 'M1';
  var REPO = 'https://github.com/jinwuuju/Pharma-Health-Desk/blob/main/';
  var CAL = [
    { label: 'W0 진단평가', date: '2026-11-30' },
    { label: 'W1 학습 시작', date: '2026-12-07' }
  ];
  var TABS = [
    { id: 'today', label: '오늘' },
    { id: 'pipeline', label: '파이프라인' },
    { id: 'review', label: '복습' },
    { id: 'exam', label: '시험' },
    { id: 'me', label: '나' }
  ];
  var ICONS = {
    today: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' aria-hidden='true'><circle cx='12' cy='12' r='4.2'/><path d='M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5L7 7M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5'/></svg>`,
    pipeline: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' aria-hidden='true'><path d='M4 6.5h12M4 12h16M4 17.5h8'/></svg>`,
    review: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linejoin='round' stroke-linecap='round' aria-hidden='true'><rect x='7' y='3.5' width='12.5' height='14.5' rx='2.5'/><path d='M4.5 7.5V18a2.5 2.5 0 0 0 2.5 2.5h9'/></svg>`,
    exam: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><rect x='5' y='3.5' width='14' height='17' rx='2.5'/><path d='M8.6 12.3l2.3 2.3 4.6-4.8'/></svg>`,
    me: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' aria-hidden='true'><circle cx='12' cy='8.6' r='3.8'/><path d='M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6'/></svg>`,
    tray: `<svg width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.4' stroke-linejoin='round' aria-hidden='true'><path d='M3.5 13.5l2.2-7.1A2 2 0 0 1 7.6 5h8.8a2 2 0 0 1 1.9 1.4l2.2 7.1v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'/><path d='M3.5 13.5h4.6l1.4 2.2h5l1.4-2.2h4.6'/></svg>`
  };
  var STEP_ICON = {
    done: `<svg width='22' height='22' viewBox='0 0 22 22' aria-hidden='true'><circle cx='11' cy='11' r='10' fill='var(--green)'/><path d='M6.5 11.4l3 3 6-6.4' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
    next: `<svg width='22' height='22' viewBox='0 0 22 22' aria-hidden='true'><circle cx='11' cy='11' r='9.25' fill='none' stroke='var(--blue)' stroke-width='1.5'/><circle cx='11' cy='11' r='5' fill='var(--blue)'/></svg>`,
    todo: `<svg width='22' height='22' viewBox='0 0 22 22' aria-hidden='true'><circle cx='11' cy='11' r='9.25' fill='none' stroke='var(--gray)' stroke-width='1.5' opacity='.6'/></svg>`
  };
  STEP_ICON.doing = STEP_ICON.next;
  var STEP_LABEL = { done: '완료', doing: '진행 중', next: '다음', todo: '예정' };
  var EXAM_LABEL = { diagnostic: '진단평가', weekly: '주간 미니 시험', unit: '단원 시험', L1: 'PBJ L1', L2: 'PBJ L2', L3: 'PBJ L3', oral: '모의 구술' };

  var state = { settings: S.loadSettings(), tab: '', sub: '', token: 0, busy: false, pendingRestore: null, lastFocus: null };
  var toastTimer = null;

  function el(id) { return document.getElementById(id); }
  function li(m) { return `<li>${esc(m)}</li>`; }
  function courseName(id) { return id === 'healthbeat' ? 'HEALTH BEAT' : 'PIPELINE'; }
  function coursePill(id) { return `<span class='pill ${id === 'healthbeat' ? 'mint' : 'blue'}'>${courseName(id)}</span>`; }
  function packLabel(pk) {
    var w = typeof pk.week === 'number' ? 'W' + (pk.week < 10 ? '0' : '') + pk.week + ' · ' : '';
    return w + (pk.title || pk.packId);
  }
  function sortPacks(list) {
    return list.slice().sort(function (a, b) {
      return String(a.courseId).localeCompare(String(b.courseId)) || ((a.week || 0) - (b.week || 0)) || String(a.packId).localeCompare(String(b.packId));
    });
  }
  function emptyCard(title, text, buttons) {
    return `<div class='card empty'>${ICONS.tray}<h3>${esc(title)}</h3><p>${esc(text)}</p>${buttons ? `<div class='btn-row'>${buttons}</div>` : ''}</div>`;
  }

  /* ---------- 표시 설정 ---------- */
  function applyTheme() {
    var th = state.settings.theme;
    var root = document.documentElement;
    if (th === 'light' || th === 'dark') { root.setAttribute('data-theme', th); } else { root.removeAttribute('data-theme'); }
    var dark = th === 'dark' || (th !== 'light' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) { meta.setAttribute('content', dark ? '#000000' : '#F2F2F7'); }
  }
  function applyFont() {
    var f = Number(state.settings.fontScale) || 1;
    document.documentElement.style.fontSize = (16 * f) + 'px';
  }

  /* ---------- 이동 ---------- */
  function parseHash() {
    var h = String(location.hash || '');
    h = h.indexOf('#/') === 0 ? h.slice(2) : '';
    var parts = h.split('/');
    var ok = TABS.some(function (t) { return t.id === parts[0]; });
    return { tab: ok ? parts[0] : 'today', sub: ok ? (parts[1] || '') : '' };
  }
  function go(tab, sub) {
    var h = '#/' + tab + (sub ? '/' + sub : '');
    if (location.hash === h) { route(); } else { location.hash = h; }
  }
  function route() {
    var r = parseHash();
    var moved = r.tab !== state.tab || r.sub !== state.sub;
    state.tab = r.tab;
    state.sub = r.sub;
    renderTabbar();
    var token = ++state.token;
    var screen = SCREENS[state.tab] || screenToday;
    Promise.resolve().then(screen).then(function (html) {
      if (token !== state.token) { return; }
      el('main').innerHTML = html;
      afterRender();
      if (moved) { window.scrollTo(0, 0); }
    }).catch(fatal);
  }
  function refresh() { route(); }
  function renderTabbar() {
    el('tabbar').innerHTML = `<div class='brand'>기자 데스크</div>` + TABS.map(function (t) {
      var cur = state.tab === t.id ? ` aria-current='page'` : '';
      return `<button type='button' class='tab' data-action='tab' data-tab='${t.id}'${cur}>${ICONS[t.id]}<span>${t.label}</span></button>`;
    }).join('');
  }

  /* ---------- 화면: 오늘 ---------- */
  function rings(values) {
    var defs = [[44, 'var(--ring-review)'], [33, 'var(--ring-new)'], [22, 'var(--ring-apply)']];
    var out = defs.map(function (d, i) {
      var r = d[0], c = 2 * Math.PI * r;
      var v = Math.max(0, Math.min(1, values[i] || 0));
      var track = `<circle cx='54' cy='54' r='${r}' fill='none' stroke='${d[1]}' stroke-opacity='.18' stroke-width='9'/>`;
      if (!v) { return track; }
      return track + `<circle class='fg' cx='54' cy='54' r='${r}' fill='none' stroke='${d[1]}' stroke-width='9' stroke-linecap='round' stroke-dasharray='${c.toFixed(1)}' stroke-dashoffset='${(c * (1 - v)).toFixed(1)}' transform='rotate(-90 54 54)'/>`;
    }).join('');
    return `<svg class='ring' width='108' height='108' viewBox='0 0 108 108' role='img' aria-label='오늘의 링: 복습, 신규, 적용'>${out}</svg>`;
  }
  function screenToday() {
    return P.summary().then(function (sum) {
      var s = state.settings;
      var today = U.studyDate(s.dayStartHour);
      var cal = CAL.slice();
      if (s.interviewDate) { cal.push({ label: '목표 면접일', date: s.interviewDate }); }
      var dd = cal.map(function (e) {
        var d = U.daysBetween(today, e.date);
        var big = d > 0 ? 'D-' + d : (d === 0 ? 'D-DAY' : 'D+' + (-d));
        return `<div class='card stat'><b>${esc(big)}</b><span>${esc(e.label)} · ${esc(U.dots(e.date.slice(5)))}</span></div>`;
      }).join('');
      var content = sum.packs > 0
        ? `<div class='card'><div class='stats4'>` +
          `<div class='stat'><b>${sum.packs}</b><span>팩</span></div>` +
          `<div class='stat'><b>${sum.kinds.lesson}</b><span>레슨</span></div>` +
          `<div class='stat'><b>${sum.kinds.card}</b><span>카드</span></div>` +
          `<div class='stat'><b>${sum.kinds.item}</b><span>문항</span></div>` +
          `</div><div class='btn-row'><button type='button' class='btn secondary' data-action='go-me'>콘텐츠 관리</button></div></div>`
        : emptyCard('아직 콘텐츠가 없습니다', '샘플 팩으로 동작을 확인하거나, AI로 만든 콘텐츠 팩(JSON)을 가져오세요.',
          `<button type='button' class='btn' data-action='load-sample'>샘플 불러오기</button><button type='button' class='btn secondary' data-action='import-file'>팩 가져오기</button>`);
      return `<div class='eyebrow'>${esc(U.koDate())}</div><h1 class='large-title'>오늘</h1>` +
        `<div class='card'><div class='rings'>${rings([0, 0, 0])}<div class='ring-legend'>` +
        `<div><span class='dot' style='background:var(--ring-review)'></span>복습 <b>0</b></div>` +
        `<div><span class='dot' style='background:var(--ring-new)'></span>신규 <b>0 / ${esc(s.dailyNew)}</b></div>` +
        `<div><span class='dot' style='background:var(--ring-apply)'></span>적용 <b>0 / 1</b></div>` +
        `</div></div><p class='note'>오늘의 세션은 설치 단계 8(M5)에서 열립니다. 지금은 콘텐츠 가져오기와 백업을 준비할 수 있습니다.</p></div>` +
        `<div class='section-title'>학습 일정</div><div class='grid2'>${dd}</div>` +
        `<div class='section-title'>가져온 콘텐츠</div>${content}`;
    });
  }

  /* ---------- 화면: 파이프라인 ---------- */
  function lessonRow(l, indent) {
    return `<div class='row${indent ? ' indent' : ''}'><div class='tx'>${esc(l.data.title || l.id)}<span class='sub'>${esc(l.id)}${l.data.minutes ? ' · ' + esc(l.data.minutes) + '분' : ''}</span></div></div>`;
  }
  function screenPipeline() {
    return Promise.all([S.getAll('packs'), S.getAll('content', 'kind', 'unit'), S.getAll('content', 'kind', 'lesson')]).then(function (res) {
      var packs = sortPacks(res[0]), units = res[1], lessons = res[2];
      var head = `<h1 class='large-title'>파이프라인</h1>`;
      if (!units.length && !lessons.length) {
        return head + emptyCard('표시할 레슨이 없습니다', '콘텐츠 팩을 가져오면 단원과 레슨이 여기에 나타납니다.', `<button type='button' class='btn secondary' data-action='go-me'>콘텐츠 가져오기</button>`);
      }
      var body = packs.map(function (pk) {
        var pu = units.filter(function (u) { return u.packId === pk.packId; }).sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
        var pl = lessons.filter(function (l) { return l.packId === pk.packId; });
        if (!pu.length && !pl.length) { return ''; }
        var used = {};
        var rows = pu.map(function (u) {
          var ls = (u.data.lessonIds || []).map(function (id) { return pl.filter(function (l) { return l.id === id; })[0]; }).filter(Boolean);
          ls.forEach(function (l) { used[l.id] = true; });
          return `<div class='row'><div class='tx'><b>${esc(u.data.title || u.id)}</b><span class='sub'>${esc(u.data.domain || '')} · 레슨 ${ls.length}개</span></div></div>` + ls.map(function (l) { return lessonRow(l, true); }).join('');
        }).join('');
        var rest = pl.filter(function (l) { return !used[l.id]; }).map(function (l) { return lessonRow(l, false); }).join('');
        return `<div class='section-title'>${coursePill(pk.courseId)} ${esc(packLabel(pk))}</div><div class='list'>${rows}${rest}</div>`;
      }).join('');
      return head + body + `<p class='footnote'>레슨 읽기는 설치 단계 4(M3), 개발 단계 지도와 마스터리 표시는 단계 12(M6)에서 열립니다.</p>`;
    });
  }

  /* ---------- 화면: 복습 ---------- */
  function screenReview() {
    return S.getAll('content', 'kind', 'card').then(function (cards) {
      var head = `<h1 class='large-title'>복습</h1>`;
      if (!cards.length) {
        return head + emptyCard('복습할 카드가 없습니다', '콘텐츠 팩을 가져오면 카드가 여기에 나타납니다.', `<button type='button' class='btn secondary' data-action='go-me'>콘텐츠 가져오기</button>`);
      }
      var list = cards.slice(0, 100).map(function (c) {
        var d = c.data;
        var more = (d.why ? '<br><br>왜: ' + esc(d.why) : '') + (d.example ? '<br><br>예: ' + esc(d.example) : '');
        return `<details class='row-d'><summary><span class='tx'>${esc(d.front || c.id)}</span><span class='chev'>›</span></summary><div class='ans'>${esc(d.back || '')}${more}</div></details>`;
      }).join('');
      return head + `<p class='footnote'>간격 반복 복습은 설치 단계 3(M2)에서 열립니다. 지금은 가져온 카드 ${cards.length}장을 미리 볼 수 있습니다. 먼저 떠올린 뒤 눌러서 확인하세요.</p>` +
        `<div class='section-title'>카드 미리보기</div><div class='list'>${list}</div>` +
        (cards.length > 100 ? `<p class='footnote'>처음 100장만 표시합니다.</p>` : '');
    });
  }

  /* ---------- 화면: 시험 ---------- */
  function screenExam() {
    return S.getAll('content', 'kind', 'exam').then(function (exams) {
      var head = `<h1 class='large-title'>시험</h1>`;
      var body = exams.length
        ? `<div class='list'>` + exams.map(function (x) {
          var d = x.data, pr = Number(d.passRate) || 0;
          var pass = pr > 1 ? Math.round(pr) : Math.round(pr * 100);
          var n = Array.isArray(d.itemIds) ? d.itemIds.length + '문항 · ' : '';
          return `<div class='row'><div class='tx'>${esc(EXAM_LABEL[d.kind] || d.kind || '시험')}<span class='sub'>${esc(x.id)} · ${n}${esc(d.minutes || '?')}분 · 합격 ${pass}%</span></div></div>`;
        }).join('') + `</div>`
        : emptyCard('가져온 시험이 없습니다', '진단평가(W0)나 주간 팩을 가져오면 여기에 나타납니다.', '');
      return head + body + `<p class='footnote'>응시 기능은 설치 단계 16(M9)에서 열립니다.</p>`;
    });
  }

  /* ---------- 화면: 나 ---------- */
  function seg(key, opts) {
    var cur = String(state.settings[key]);
    return `<div class='seg' role='group'>` + opts.map(function (o) {
      return `<button type='button' data-action='set' data-key='${key}' data-val='${o[0]}' aria-pressed='${cur === String(o[0]) ? 'true' : 'false'}'>${esc(o[1])}</button>`;
    }).join('') + `</div>`;
  }
  function screenMe() {
    if (state.sub === 'dev') { return screenDev(); }
    return S.getAll('packs').then(function (packs) {
      var s = state.settings;
      var packRows = sortPacks(packs).map(function (pk) {
        var c = pk.counts || {}, parts = [];
        [['lesson', '레슨'], ['card', '카드'], ['item', '문항'], ['exam', '시험'], ['entry', '백과'], ['stat', '통계']].forEach(function (k) { if (c[k[0]]) { parts.push(k[1] + ' ' + c[k[0]]); } });
        return `<div class='row'><div class='tx'>${esc(packLabel(pk))}<span class='sub'>${coursePill(pk.courseId)}${esc(pk.packId)} · v${esc(pk.version || '?')} · ${esc(parts.join(' · ') || '내용 없음')}</span></div>` +
          `<button type='button' class='del' data-action='delete-pack' data-id='${esc(pk.packId)}' aria-label='${esc(pk.packId)} 팩 삭제'>삭제</button></div>`;
      }).join('');
      if (!packRows) { packRows = `<div class='row'><div class='tx'><span class='sub'>아직 가져온 팩이 없습니다.</span></div></div>`; }
      var last = s.lastBackupAt ? U.dots(U.seoulDate(new Date(s.lastBackupAt))) : '없음';
      return `<h1 class='large-title'>나</h1>` +
        `<div class='section-title'>콘텐츠 팩</div><div class='list'>${packRows}` +
        `<button type='button' class='row action' data-action='import-file'>파일에서 팩 가져오기</button>` +
        `<button type='button' class='row action' data-action='import-paste'>붙여넣어 가져오기</button>` +
        `<button type='button' class='row action' data-action='load-sample'>샘플 팩 불러오기</button></div>` +
        `<p class='footnote'>같은 id는 새 내용으로 덮어쓰고 학습 기록은 그대로 둡니다. 나눠 받은 파트 파일(part 1·2·3)은 같은 packId로 차례로 가져오면 합쳐집니다.</p>` +
        `<div class='section-title'>데이터</div><div class='list'>` +
        `<button type='button' class='row action' data-action='export'>백업 내보내기</button>` +
        `<button type='button' class='row action' data-action='restore'>백업에서 복원</button>` +
        `<div class='row'><div class='tx'>마지막 백업</div><span class='val'>${esc(last)}</span></div>` +
        `<div class='row'><div class='tx'>저장 공간</div><span class='val' data-fill='usage'>확인 중…</span></div>` +
        `<button type='button' class='row action' data-action='persist'><span class='tx'>이 기기에 영구 저장 요청</span><span class='val' data-fill='persisted'></span></button></div>` +
        `<p class='footnote'>학습 기록은 이 기기의 브라우저에만 저장됩니다. Mac과 iPhone 사이는 백업 파일로 옮기고, 백업 파일은 공개 저장소가 아닌 곳(예: iCloud Drive)에 보관하세요.</p>` +
        `<div class='section-title'>설정</div><div class='list'>` +
        `<div class='row'><div class='tx'>화면</div>${seg('theme', [['auto', '자동'], ['light', '라이트'], ['dark', '다크']])}</div>` +
        `<div class='row'><div class='tx'>글자 크기</div>${seg('fontScale', [['0.9', '작게'], ['1', '보통'], ['1.15', '크게']])}</div>` +
        `<div class='row'><div class='tx'>입학 시나리오<span class='sub'>A 2027년 9월 · B 2028년 3월</span></div>${seg('scenario', [['A', 'A'], ['B', 'B']])}</div>` +
        `<div class='row'><label class='tx' for='set-interview'>목표 면접일</label><input id='set-interview' type='date' data-input='interviewDate' value='${esc(s.interviewDate)}'></div>` +
        `<div class='row'><label class='tx' for='set-new'>하루 신규 카드</label><input id='set-new' type='number' min='0' max='50' inputmode='numeric' data-input='dailyNew' value='${esc(s.dailyNew)}'></div>` +
        `<div class='row'><label class='tx' for='set-max'>하루 최대 복습</label><input id='set-max' type='number' min='10' max='500' inputmode='numeric' data-input='maxReviews' value='${esc(s.maxReviews)}'></div></div>` +
        `<div class='section-title'>앱</div><div class='list'>` +
        `<a class='row' href='#/me/dev'><div class='tx'>개발 현황<span class='sub'>설치 단계와 문서</span></div><span class='chev'>›</span></a>` +
        `<div class='row'><div class='tx'>버전</div><span class='val'>${APP_STEP} · 저장 스키마 v${S.SCHEMA_VERSION}</span></div>` +
        `<button type='button' class='row danger' data-action='reset'>모든 데이터 지우기</button></div>` +
        `<p class='footnote'>의학·통계·시장 정보는 검수 전 초안일 수 있습니다. 항목마다 기준일과 출처를 확인하세요. 이 앱은 진단·치료 판단을 위한 것이 아닙니다.</p>`;
    });
  }
  function devRing(done, total) {
    var r = 30, c = 2 * Math.PI * r;
    var off = c * (1 - (total ? done / total : 0));
    return `<svg class='ring' width='76' height='76' viewBox='0 0 76 76' role='img' aria-label='설치 진행 ${done} / ${total}'>` +
      `<circle cx='38' cy='38' r='${r}' fill='none' stroke='var(--fill)' stroke-width='9'/>` +
      `<circle class='fg' cx='38' cy='38' r='${r}' fill='none' stroke='var(--blue)' stroke-width='9' stroke-linecap='round' stroke-dasharray='${c.toFixed(1)}' stroke-dashoffset='${off.toFixed(1)}' transform='rotate(-90 38 38)'/>` +
      `<text x='38' y='43' text-anchor='middle' font-size='15' font-weight='700' fill='var(--text)'>${done}/${total}</text></svg>`;
  }
  function screenDev() {
    var head = `<a class='back' href='#/me'>‹ 나</a><h1 class='large-title'>개발 현황</h1>`;
    return fetch('data/project.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (p) {
      var steps = p.steps || [];
      var done = steps.filter(function (x) { return x.status === 'done'; });
      var cur = steps.filter(function (x) { return x.status === 'doing'; })[0] || steps.filter(function (x) { return x.status === 'next'; })[0];
      var hero = `<div class='card hero'>${devRing(done.length, steps.length)}<div>` +
        `<span class='pill blue'>${cur ? esc(STEP_LABEL[cur.status]) + ' · ' + esc(cur.id) : '모두 완료'}</span>` +
        `<h2>${cur ? esc(cur.title) : '설치 완료'}</h2><p>${cur && cur.detail ? esc(cur.detail) : ''}</p><p>현황 갱신 ${esc(U.dots(p.updated))}</p></div></div>`;
      var list = steps.map(function (x, i) {
        var tag = x.date ? U.dots(x.date.slice(5)) : (STEP_LABEL[x.status] || '');
        return `<div class='row step ${esc(x.status)}'><span class='ic'>${STEP_ICON[x.status] || STEP_ICON.todo}</span><div class='tx'>${i}. ${esc(x.id)} · ${esc(x.title)}${x.detail ? `<span class='sub'>${esc(x.detail)}</span>` : ''}</div><span class='val'>${esc(tag)}</span></div>`;
      }).join('');
      var docs = (p.docs || []).map(function (d) {
        return `<a class='row' href='${esc(REPO + d.path)}' target='_blank' rel='noopener'><div class='tx'>${esc(d.title)}<span class='sub'>${esc(d.desc)}</span></div><span class='chev'>›</span></a>`;
      }).join('');
      return head + hero + `<div class='section-title'>설치 단계</div><div class='list'>${list}</div><div class='section-title'>문서</div><div class='list'>${docs}</div>`;
    }).catch(function () {
      return head + `<div class='card'><p>설치 현황을 읽지 못했습니다. 파일을 직접 열면(file://) 읽을 수 없습니다. https://jinwuuju.github.io/Pharma-Health-Desk/ 에서 열어 주세요.</p></div>`;
    });
  }

  var SCREENS = { today: screenToday, pipeline: screenPipeline, review: screenReview, exam: screenExam, me: screenMe };

  function afterRender() {
    var usage = document.querySelector('[data-fill=usage]');
    if (usage) {
      S.estimate().then(function (e) {
        usage.textContent = e && e.usage != null ? U.fmtBytes(e.usage) + (e.quota ? ' / ' + U.fmtBytes(e.quota) : '') : '확인 불가';
      });
    }
    var pers = document.querySelector('[data-fill=persisted]');
    if (pers) {
      S.persisted().then(function (v) { pers.textContent = v === true ? '켜짐' : (v === false ? '꺼짐' : '지원 안 함'); });
    }
  }

  /* ---------- 시트·알림 ---------- */
  function openSheet(html) {
    var b = el('sheet');
    if (b.hidden) { state.lastFocus = document.activeElement; }
    b.innerHTML = `<div class='sheet' role='dialog' aria-modal='true'>${html}</div>`;
    b.hidden = false;
    var f = b.querySelector('textarea') || b.querySelector('.btn');
    if (f) { f.focus(); }
  }
  function closeSheet() {
    var b = el('sheet');
    b.hidden = true;
    b.innerHTML = '';
    state.pendingRestore = null;
    if (state.lastFocus && state.lastFocus.focus) { state.lastFocus.focus(); }
  }
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function fatal(err) {
    var msg = err && err.message ? err.message : String(err);
    el('main').innerHTML = `<div class='card' style='margin-top:40px'><h2>앱을 열지 못했습니다</h2><p class='note'>${esc(msg)}</p><p class='note'>새로고침해도 같으면 다른 브라우저로 열어 보고, 개발 현황의 문서를 참고하세요.</p></div>`;
  }

  /* ---------- 가져오기 ---------- */
  function importText(text, label) {
    var obj;
    try { obj = JSON.parse(U.stripFences(text)); } catch (e) {
      return Promise.resolve({ ok: false, label: label, errors: ['JSON 형식 오류: ' + e.message + ' — AI 답변의 JSON 부분만 복사했는지, 잘린 곳이 없는지 확인하세요.'], warnings: [] });
    }
    return P.importPack(obj, label).catch(function (e) {
      return { ok: false, label: label, errors: ['저장 중 오류: ' + (e && e.message ? e.message : e)], warnings: [] };
    });
  }
  function showImportResults(results) {
    var html = `<div class='grab'></div><h2>가져오기 결과</h2>` + results.map(function (r) {
      var title = esc(r.label || r.packId || '가져오기');
      var warn = r.warnings && r.warnings.length ? `<ul class='msgs'>${r.warnings.map(li).join('')}</ul>` : '';
      if (!r.ok) { return `<div class='card'><b>✕ ${title}</b><ul class='msgs err'>${r.errors.map(li).join('')}</ul>${warn}</div>`; }
      return `<div class='card'><b>✓ ${title}</b><p class='note'>${esc(r.packId)} · ${courseName(r.courseId)} · 새로 ${r.added}개 · 갱신 ${r.updated}개</p>${warn}</div>`;
    }).join('') + `<div class='btn-row'><button type='button' class='btn' data-action='sheet-close'>확인</button></div>`;
    openSheet(html);
  }
  function onPackFile(input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length || state.busy) { return; }
    state.busy = true;
    var results = [];
    files.reduce(function (p, f) {
      return p.then(function () {
        return U.readFile(f).then(function (text) { return importText(text, f.name); }).then(function (r) { results.push(r); });
      });
    }, Promise.resolve()).then(function () {
      showImportResults(results);
      refresh();
    }).catch(function (e) { toast('가져오지 못했습니다: ' + e.message); }).then(function () { state.busy = false; });
  }
  function openPaste() {
    openSheet(`<div class='grab'></div><h2>붙여넣어 가져오기</h2><p>AI가 출력한 콘텐츠 팩 JSON 전체를 붙여 넣으세요. 앞뒤의 코드 울타리(json 표시)가 함께 붙어도 됩니다.</p>` +
      `<textarea id='paste-box' spellcheck='false' autocapitalize='off' autocomplete='off' autocorrect='off' aria-label='콘텐츠 팩 JSON'></textarea>` +
      `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>취소</button><button type='button' class='btn' data-action='paste-import'>가져오기</button></div>`);
  }
  function pasteImport() {
    var box = el('paste-box');
    var text = box ? box.value : '';
    if (!text.trim()) { toast('붙여 넣은 내용이 없습니다.'); return; }
    if (state.busy) { return; }
    state.busy = true;
    importText(text, '붙여넣기').then(function (res) {
      showImportResults([res]);
      refresh();
    }).then(function () { state.busy = false; });
  }
  function loadSample() {
    if (state.busy) { return; }
    state.busy = true;
    fetch('packs/sample.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.text();
    }).then(function (text) {
      return importText(text, '샘플 팩');
    }).then(function (res) {
      showImportResults([res]);
      refresh();
    }).catch(function () {
      toast('샘플 팩을 읽지 못했습니다. 배포 주소에서 열었는지 확인하세요.');
    }).then(function () { state.busy = false; });
  }
  function deletePack(packId) {
    if (!packId) { return; }
    if (!window.confirm(packId + ' 팩의 콘텐츠를 지웁니다. 학습 기록은 남습니다. 계속할까요?')) { return; }
    P.deletePack(packId).then(function (n) {
      toast('삭제했습니다 (' + n + '개 항목)');
      refresh();
    }).catch(function (e) { toast('삭제하지 못했습니다: ' + e.message); });
  }

  /* ---------- 백업 ---------- */
  function doExport() {
    S.exportAll(state.settings).then(function (data) {
      U.download('phd-backup-' + U.stamp() + '.json', JSON.stringify(data, null, 2));
      state.settings.lastBackupAt = new Date().toISOString();
      S.saveSettings(state.settings);
      toast('백업 파일을 저장했습니다. 저장소가 아닌 곳(예: iCloud Drive)에 보관하세요.');
      refresh();
    }).catch(function (e) { toast('백업하지 못했습니다: ' + e.message); });
  }
  function onBackupFile(input) {
    var f = input.files && input.files[0];
    input.value = '';
    if (!f) { return; }
    U.readFile(f).then(function (text) {
      var obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error('JSON 형식 오류: ' + e.message); }
      var v = S.validateBackup(obj);
      if (v.errors.length) {
        openSheet(`<div class='grab'></div><h2>복원할 수 없습니다</h2><ul class='msgs err'>${v.errors.map(li).join('')}</ul><div class='btn-row'><button type='button' class='btn' data-action='sheet-close'>확인</button></div>`);
        return;
      }
      var c = v.counts;
      var when = v.exportedAt ? U.dots(U.seoulDate(new Date(v.exportedAt))) : '알 수 없음';
      openSheet(`<div class='grab'></div><h2>백업에서 복원</h2><p>지금 이 기기의 데이터를 백업 내용으로 모두 바꿉니다. 되돌릴 수 없으니 필요하면 먼저 현재 데이터를 백업하세요.</p>` +
        `<div class='card'><p class='note' style='margin-top:0'>백업 날짜 ${esc(when)} · 팩 ${c.packs || 0} · 콘텐츠 ${c.content || 0} · 학습 기록 ${(c.progress || 0) + (c.attempts || 0)}</p></div>` +
        `<div class='btn-row'><button type='button' class='btn secondary' data-action='sheet-close'>취소</button><button type='button' class='btn danger' data-action='restore-confirm'>복원</button></div>`);
      state.pendingRestore = obj;
    }).catch(function (e) { toast(e.message); });
  }
  function restoreConfirm() {
    var obj = state.pendingRestore;
    if (!obj) { closeSheet(); return; }
    S.restoreAll(obj).then(function (r) {
      state.settings = S.loadSettings();
      applyTheme();
      applyFont();
      closeSheet();
      toast('복원했습니다' + (r.skipped ? ' (형식이 맞지 않는 ' + r.skipped + '개는 건너뜀)' : ''));
      refresh();
    }).catch(function (e) { toast('복원하지 못했습니다: ' + e.message); });
  }
  function doPersist() {
    S.persist().then(function (ok) {
      if (ok === true) { toast('영구 저장이 켜졌습니다.'); }
      else if (ok === false) { toast('브라우저가 영구 저장을 허락하지 않았습니다. iPhone은 홈 화면에 추가하면 데이터가 더 오래 보존됩니다.'); }
      else { toast('이 브라우저는 영구 저장 요청을 지원하지 않습니다.'); }
      refresh();
    });
  }
  function doReset() {
    if (!window.confirm('이 기기의 콘텐츠·학습 기록·설정을 모두 지웁니다. 먼저 백업했나요?')) { return; }
    if (!window.confirm('정말 지울까요? 되돌릴 수 없습니다.')) { return; }
    S.resetAll().then(function () {
      state.settings = S.loadSettings();
      applyTheme();
      applyFont();
      toast('모든 데이터를 지웠습니다.');
      go('today');
    }).catch(function (e) { toast('지우지 못했습니다: ' + e.message); });
  }
  function setSetting(key, val) {
    if (!key) { return; }
    if (key === 'fontScale') { val = Number(val) || 1; }
    state.settings[key] = val;
    S.saveSettings(state.settings);
    if (key === 'theme') { applyTheme(); }
    if (key === 'fontScale') { applyFont(); }
    refresh();
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!t) { return; }
    switch (t.getAttribute('data-action')) {
      case 'tab': go(t.getAttribute('data-tab')); break;
      case 'go-me': go('me'); break;
      case 'import-file': el('file-pack').click(); break;
      case 'import-paste': openPaste(); break;
      case 'paste-import': pasteImport(); break;
      case 'load-sample': loadSample(); break;
      case 'delete-pack': deletePack(t.getAttribute('data-id')); break;
      case 'export': doExport(); break;
      case 'restore': el('file-backup').click(); break;
      case 'restore-confirm': restoreConfirm(); break;
      case 'persist': doPersist(); break;
      case 'reset': doReset(); break;
      case 'set': setSetting(t.getAttribute('data-key'), t.getAttribute('data-val')); break;
      case 'sheet-close': closeSheet(); break;
      default: break;
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t) { return; }
    if (t.id === 'file-pack') { onPackFile(t); return; }
    if (t.id === 'file-backup') { onBackupFile(t); return; }
    var key = t.getAttribute && t.getAttribute('data-input');
    if (!key) { return; }
    var v = t.value;
    if (key === 'dailyNew') { v = U.clampInt(v, 0, 50, 8); }
    if (key === 'maxReviews') { v = U.clampInt(v, 10, 500, 80); }
    state.settings[key] = v;
    S.saveSettings(state.settings);
    t.value = v;
    toast('저장했습니다.');
  });
  el('sheet').addEventListener('click', function (ev) { if (ev.target === el('sheet')) { closeSheet(); } });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !el('sheet').hidden) { closeSheet(); } });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) { mq.addEventListener('change', applyTheme); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- 시작 ---------- */
  applyTheme();
  applyFont();
  renderTabbar();
  S.open().then(route).catch(fatal);
})();
