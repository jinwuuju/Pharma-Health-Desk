/* 진우주 기자 학교 — 저장소. IndexedDB(콘텐츠·학습 기록) + localStorage(설정). D004·D010. */
(function () {
  'use strict';
  var DB_NAME = 'pharma-health-desk';
  var DB_VERSION = 1;      // IndexedDB 구조 버전
  var SCHEMA_VERSION = 1;  // 백업·설정 스키마 버전
  var SETTINGS_KEY = 'phd.settings';
  var STORES = ['meta', 'packs', 'content', 'progress', 'attempts', 'daylogs'];
  var KEYS = { meta: 'key', packs: 'packId', content: 'id', progress: 'id', attempts: 'id', daylogs: 'key' };
  var DEFAULT_SETTINGS = {
    schemaVersion: SCHEMA_VERSION, theme: 'auto', fontScale: 1, scenario: 'A', interviewDate: '',
    dailyNew: 8, maxReviews: 80, retention: 0.9, dayStartHour: 4, lastBackupAt: '', sound: true, nickname: '', pipelineOpen: false, autoUpdate: true, skipPacks: []
  };
  var dbPromise = null;

  function open() {
    if (dbPromise) { return dbPromise; }
    dbPromise = new Promise(function (resolve, reject) {
      var idb = window.indexedDB;
      if (!idb) { reject(new Error('이 브라우저에서는 저장소(IndexedDB)를 쓸 수 없습니다. 개인정보 보호(시크릿) 모드라면 일반 모드로 열어 주세요.')); return; }
      var req;
      try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function (ev) { upgrade(req.result, ev.oldVersion || 0); };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); };
        resolve(db);
      };
      req.onerror = function () { reject(req.error || new Error('저장소를 열지 못했습니다.')); };
      req.onblocked = function () { reject(new Error('다른 탭에서 앱이 열려 있어 저장소를 업데이트하지 못했습니다. 다른 탭을 닫고 새로고침하세요.')); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  // IndexedDB 구조 마이그레이션. 버전을 올릴 때는 아래에 단계를 추가하고, 지난 단계는 지우지 않는다.
  function upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('packs', { keyPath: 'packId' });
      var content = db.createObjectStore('content', { keyPath: 'id' });
      content.createIndex('packId', 'packId', { unique: false });
      content.createIndex('kind', 'kind', { unique: false });
      content.createIndex('courseId', 'courseId', { unique: false });
      var progress = db.createObjectStore('progress', { keyPath: 'id' });
      progress.createIndex('courseId', 'courseId', { unique: false });
      var attempts = db.createObjectStore('attempts', { keyPath: 'id' });
      attempts.createIndex('itemId', 'itemId', { unique: false });
      db.createObjectStore('daylogs', { keyPath: 'key' });
    }
  }

  // 트랜잭션이 끝난(complete) 뒤에 결과를 돌려준다. fn은 { value } 상자를 돌려준다.
  function tx(names, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = db.transaction(names, mode); } catch (e) { reject(e); return; }
        var box;
        try { box = fn(t) || {}; } catch (e) {
          try { t.abort(); } catch (ignore) { /* 이미 끝난 트랜잭션 */ }
          reject(e);
          return;
        }
        t.oncomplete = function () { resolve(box.value); };
        t.onerror = function () { reject(t.error || new Error('저장 중 오류가 났습니다.')); };
        t.onabort = function () { reject(t.error || new Error('저장이 취소되었습니다.')); };
      });
    });
  }
  function source(t, store, indexName) {
    var os = t.objectStore(store);
    return indexName ? os.index(indexName) : os;
  }
  function getAll(store, indexName, key) {
    return tx([store], 'readonly', function (t) {
      var box = { value: [] };
      var src = source(t, store, indexName);
      var r = key === undefined ? src.getAll() : src.getAll(key);
      r.onsuccess = function () { box.value = r.result || []; };
      return box;
    });
  }
  function get(store, key) {
    return tx([store], 'readonly', function (t) {
      var box = { value: undefined };
      var r = t.objectStore(store).get(key);
      r.onsuccess = function () { box.value = r.result; };
      return box;
    });
  }
  function getMany(store, keys) {
    return tx([store], 'readonly', function (t) {
      var box = { value: {} };
      var os = t.objectStore(store);
      keys.forEach(function (k) {
        var r = os.get(k);
        r.onsuccess = function () { if (r.result) { box.value[k] = r.result; } };
      });
      return box;
    });
  }
  function count(store, indexName, key) {
    return tx([store], 'readonly', function (t) {
      var box = { value: 0 };
      var src = source(t, store, indexName);
      var r = key === undefined ? src.count() : src.count(key);
      r.onsuccess = function () { box.value = r.result || 0; };
      return box;
    });
  }
  function putMany(store, rows) {
    return tx([store], 'readwrite', function (t) {
      var os = t.objectStore(store);
      rows.forEach(function (row) { os.put(row); });
      return { value: rows.length };
    });
  }
  function del(store, key) {
    return tx([store], 'readwrite', function (t) {
      t.objectStore(store).delete(key);
      return { value: true };
    });
  }
  function deleteByIndex(store, indexName, key) {
    return tx([store], 'readwrite', function (t) {
      var box = { value: 0 };
      var r = t.objectStore(store).index(indexName).openCursor(key);
      r.onsuccess = function () {
        var c = r.result;
        if (c) { c.delete(); box.value += 1; c.continue(); }
      };
      return box;
    });
  }

  // 설정: 저장된 값 위에 새 기본값을 채워 넣는다(옛 설정 호환).
  function migrateSettings(s) {
    var out = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
    if (s && typeof s === 'object') { Object.keys(s).forEach(function (k) { out[k] = s[k]; }); }
    out.schemaVersion = SCHEMA_VERSION;
    return out;
  }
  function loadSettings() {
    var raw = null, s = null;
    try { raw = window.localStorage.getItem(SETTINGS_KEY); } catch (e) { raw = null; }
    try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
    return migrateSettings(s);
  }
  function saveSettings(s) {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  // 백업
  function exportAll(settings) {
    return Promise.all(STORES.map(function (n) { return getAll(n); })).then(function (lists) {
      var stores = {};
      STORES.forEach(function (n, i) { stores[n] = lists[i]; });
      return {
        app: 'pharma-health-desk', kind: 'backup', schemaVersion: SCHEMA_VERSION, dbVersion: DB_VERSION,
        exportedAt: new Date().toISOString(), settings: settings || loadSettings(), stores: stores
      };
    });
  }
  function validateBackup(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { return { errors: ['백업 파일 형식이 아닙니다.'], counts: {} }; }
    if (obj.app !== 'pharma-health-desk' || obj.kind !== 'backup') { errors.push('이 앱의 백업 파일이 아닙니다. 콘텐츠 팩이라면 ‘팩 가져오기’를 쓰세요.'); }
    if (typeof obj.schemaVersion !== 'number') { errors.push('schemaVersion이 없습니다.'); }
    else if (obj.schemaVersion > SCHEMA_VERSION) { errors.push('더 새 버전의 앱에서 만든 백업입니다. 새로고침해 최신 앱으로 연 뒤 다시 시도하세요.'); }
    if (!obj.stores || typeof obj.stores !== 'object') { errors.push('stores가 없습니다.'); }
    var counts = {};
    if (obj.stores) { STORES.forEach(function (n) { counts[n] = Array.isArray(obj.stores[n]) ? obj.stores[n].length : 0; }); }
    return { errors: errors, counts: counts, exportedAt: obj.exportedAt || '' };
  }
  // 옛 스키마 백업을 현재 스키마로 바꾼다. 스키마를 올릴 때 이곳에 단계를 추가한다.
  function migrateBackup(obj) { return obj; }
  function restoreAll(obj) {
    obj = migrateBackup(obj);
    var skipped = 0;
    return tx(STORES, 'readwrite', function (t) {
      STORES.forEach(function (n) {
        var os = t.objectStore(n);
        os.clear();
        (obj.stores[n] || []).forEach(function (row) {
          if (row && typeof row === 'object' && row[KEYS[n]] != null) { os.put(row); } else { skipped += 1; }
        });
      });
      return { value: true };
    }).then(function () {
      if (obj.settings) { saveSettings(migrateSettings(obj.settings)); }
      return { skipped: skipped };
    });
  }
  function resetAll() {
    return tx(STORES, 'readwrite', function (t) {
      STORES.forEach(function (n) { t.objectStore(n).clear(); });
      return { value: true };
    }).then(function () {
      try { window.localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* 무시 */ }
    });
  }
  function estimate() {
    var st = navigator.storage;
    if (!st || !st.estimate) { return Promise.resolve(null); }
    return st.estimate().catch(function () { return null; });
  }
  function persisted() {
    var st = navigator.storage;
    if (!st || !st.persisted) { return Promise.resolve(null); }
    return st.persisted().catch(function () { return null; });
  }
  function persist() {
    var st = navigator.storage;
    if (!st || !st.persist) { return Promise.resolve(null); }
    return st.persist().catch(function () { return false; });
  }

  window.PHD = window.PHD || {};
  window.PHD.store = {
    DB_VERSION: DB_VERSION, SCHEMA_VERSION: SCHEMA_VERSION, STORES: STORES,
    open: open, getAll: getAll, get: get, getMany: getMany, count: count, putMany: putMany, del: del, deleteByIndex: deleteByIndex,
    loadSettings: loadSettings, saveSettings: saveSettings,
    exportAll: exportAll, validateBackup: validateBackup, restoreAll: restoreAll, resetAll: resetAll,
    estimate: estimate, persisted: persisted, persist: persist
  };
})();
