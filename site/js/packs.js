/* 진우주 기자 학교 — 콘텐츠 팩 검사·가져오기. 기획안 1의 10.2~10.3, D010. */
(function () {
  'use strict';
  var S = window.PHD.store;
  var KINDS = {
    units: 'unit', lessons: 'lesson', cards: 'card', items: 'item', cases: 'case', dailyReleases: 'dailyRelease',
    dealRounds: 'dealRound', exams: 'exam', glossary: 'glossary', sources: 'source', entries: 'entry', stats: 'stat',
    plans: 'plan', calendar: 'calendar',
    elements: 'element', recipes: 'recipe', evidence: 'evidence', diseases: 'disease'
  };
  var META_KEYS = ['packId', 'version', 'week', 'domains', 'title', 'courseId', 'description', 'kind', 'part', 'review'];
  var COURSES = ['pipeline', 'healthbeat'];
  var MAX_MSG = 30;

  function fail(errors, warnings) { return { errors: errors, warnings: warnings || [], rows: [], meta: null }; }

  function validate(obj) {
    var errors = [], warnings = [], rows = [];
    if (Array.isArray(obj)) { return fail(['최상위가 배열입니다. 마스터 색인·통계 목록 같은 배열 파일은 설치 단계 5(C1·E1)부터 가져올 수 있습니다.']); }
    if (!obj || typeof obj !== 'object') { return fail(['JSON 객체가 아닙니다.']); }
    if (obj.app === 'pharma-health-desk' && obj.kind === 'backup') { return fail(['백업 파일입니다. ‘백업에서 복원’을 쓰세요.']); }
    var packId = typeof obj.packId === 'string' ? obj.packId.trim() : '';
    if (!packId) { errors.push('packId가 없습니다. 콘텐츠 팩 맨 위에 packId가 있어야 합니다.'); }
    if (obj.courseId != null && COURSES.indexOf(obj.courseId) < 0) { errors.push('courseId는 pipeline 또는 healthbeat여야 합니다: ' + obj.courseId); }
    var seen = {}, lists = 0;
    Object.keys(obj).forEach(function (key) {
      if (META_KEYS.indexOf(key) >= 0) { return; }
      var kind = KINDS[key];
      if (!kind) { warnings.push('알 수 없는 묶음 ' + key + ' — 무시했습니다.'); return; }
      var list = obj[key];
      if (!Array.isArray(list)) { errors.push(key + '는 배열이어야 합니다.'); return; }
      lists += 1;
      list.forEach(function (x, i) {
        if (!x || typeof x !== 'object' || Array.isArray(x)) { warnings.push(key + ' ' + (i + 1) + '번째가 객체가 아니어서 건너뛰었습니다.'); return; }
        var id = x.id;
        if (!id && kind === 'glossary' && x.term) { id = 'GL:' + packId + ':' + x.term; }
        if (!id && kind === 'calendar' && x.date && x.name) { id = 'CAL:' + x.date + ':' + x.name; }
        if (typeof id !== 'string' || !id.trim()) { warnings.push(key + ' ' + (i + 1) + '번째에 id가 없어 건너뛰었습니다.'); return; }
        id = id.trim();
        if (seen[id]) { warnings.push('같은 파일 안에서 id가 겹칩니다: ' + id + ' (뒤의 것을 씁니다)'); }
        seen[id] = { id: id, kind: kind, packId: packId, courseId: x.courseId || null, data: x };
        checkShape(kind, x, id, warnings);
      });
    });
    if (!lists && !errors.length) { errors.push('lessons, cards, items 같은 콘텐츠 묶음이 하나도 없습니다.'); }
    Object.keys(seen).forEach(function (k) { rows.push(seen[k]); });
    var missing = countMissingRefs(rows);
    if (missing) { warnings.push('이 파일에 없는 참조 ' + missing + '개 — 다른 파트·팩에 있으면 정상입니다.'); }
    var meta = {
      packId: packId, courseId: obj.courseId || null, version: obj.version || '',
      week: typeof obj.week === 'number' ? obj.week : null, title: obj.title || '',
      domains: Array.isArray(obj.domains) ? obj.domains : [], description: obj.description || '', review: typeof obj.review === 'string' ? obj.review : ''
    };
    return { errors: errors, warnings: trimList(warnings), rows: rows, meta: meta };
  }
  function checkShape(kind, x, id, warnings) {
    if (kind === 'card' && (!x.front || !x.back)) { warnings.push('카드 ' + id + ': front 또는 back이 비어 있습니다.'); }
    if (kind === 'item' && (!x.type || !x.stem)) { warnings.push('문항 ' + id + ': type 또는 stem이 비어 있습니다.'); }
    if (kind === 'lesson' && !x.title) { warnings.push('레슨 ' + id + ': title이 없습니다.'); }
  }
  function refsOf(row) {
    var d = row.data, out = [];
    function add(list) { if (Array.isArray(list)) { list.forEach(function (v) { if (typeof v === 'string') { out.push(v); } }); } }
    if (row.kind === 'unit') { add(d.lessonIds); }
    if (row.kind === 'lesson') {
      add(d.cardIds);
      add(d.pretestItemIds);
      if (Array.isArray(d.chunks)) { d.chunks.forEach(function (c) { if (c && c.checkItemId) { out.push(c.checkItemId); } }); }
    }
    if (row.kind === 'item') { add(d.cardIds); }
    if (row.kind === 'exam' || row.kind === 'case') { add(d.itemIds); }
    return out;
  }
  function countMissingRefs(rows) {
    var ids = {}, missing = 0;
    rows.forEach(function (r) { ids[r.id] = true; });
    rows.forEach(function (r) { refsOf(r).forEach(function (ref) { if (!ids[ref]) { missing += 1; } }); });
    return missing;
  }
  function trimList(list) {
    if (list.length <= MAX_MSG) { return list; }
    return list.slice(0, MAX_MSG).concat(['외 ' + (list.length - MAX_MSG) + '건']);
  }

  // 같은 id는 새 내용으로 덮어쓰고, 학습 기록(progress·attempts)은 건드리지 않는다.
  // 같은 packId의 파트 파일은 차례로 가져오면 합쳐진다. 파트에서 비어 있는 메타 값은 기존 값을 지킨다.
  function importPack(obj, label) {
    var v = validate(obj);
    if (v.errors.length) { return Promise.resolve({ ok: false, label: label, errors: v.errors, warnings: v.warnings }); }
    var meta = v.meta, rows = v.rows, now = new Date().toISOString();
    var added = 0, updated = 0, affected = {}, oldMeta = null;
    affected[meta.packId] = true;
    return S.get('packs', meta.packId).then(function (m) {
      oldMeta = m || null;
      meta.courseId = meta.courseId || (oldMeta && oldMeta.courseId) || 'pipeline';
      rows.forEach(function (r) { if (!r.courseId) { r.courseId = meta.courseId; } });
      return S.getMany('content', rows.map(function (r) { return r.id; }));
    }).then(function (existing) {
      rows.forEach(function (r) {
        var old = existing[r.id];
        if (old) {
          updated += 1;
          if (old.packId !== r.packId) { affected[old.packId] = true; }
          r.firstImportedAt = old.firstImportedAt || old.importedAt || now;
        } else {
          added += 1;
          r.firstImportedAt = now;
        }
        r.importedAt = now;
      });
      return S.putMany('content', rows);
    }).then(function () {
      var m = {};
      if (oldMeta) { Object.keys(oldMeta).forEach(function (k) { m[k] = oldMeta[k]; }); }
      Object.keys(meta).forEach(function (k) {
        var val = meta[k];
        var empty = val == null || val === '' || (Array.isArray(val) && !val.length);
        if (!empty || !oldMeta) { m[k] = val; }
      });
      m.firstImportedAt = (oldMeta && oldMeta.firstImportedAt) || now;
      m.importedAt = now;
      m.source = label || '';
      return S.putMany('packs', [m]);
    }).then(function () {
      return Promise.all(Object.keys(affected).map(recount));
    }).then(function () {
      return { ok: true, label: label, packId: meta.packId, courseId: meta.courseId, added: added, updated: updated, warnings: v.warnings };
    });
  }
  function recount(packId) {
    return Promise.all([S.getAll('content', 'packId', packId), S.get('packs', packId)]).then(function (res) {
      var rows = res[0], meta = res[1];
      if (!meta) { return null; }
      if (!rows.length) { return S.del('packs', packId); }
      var counts = {};
      rows.forEach(function (r) { counts[r.kind] = (counts[r.kind] || 0) + 1; });
      meta.counts = counts;
      return S.putMany('packs', [meta]);
    });
  }
  function deletePack(packId) {
    return S.deleteByIndex('content', 'packId', packId).then(function (n) {
      return S.del('packs', packId).then(function () { return n; });
    });
  }
  function summary() {
    var kinds = ['lesson', 'card', 'item', 'exam', 'entry', 'stat'];
    return Promise.all([S.count('packs')].concat(kinds.map(function (k) { return S.count('content', 'kind', k); }))).then(function (n) {
      var out = { packs: n[0], kinds: {} };
      kinds.forEach(function (k, i) { out.kinds[k] = n[i + 1]; });
      return out;
    });
  }

  window.PHD.packs = { validate: validate, importPack: importPack, deletePack: deletePack, summary: summary, KINDS: KINDS };
})();
