/* 기자 데스크 — 공통 도구. 날짜는 Asia/Seoul 기준으로 이 파일에서만 계산한다. */
(function () {
  'use strict';
  var NL = String.fromCharCode(10);
  var ESC = [['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], [String.fromCharCode(34), '&quot;'], [String.fromCharCode(39), '&#39;']];

  function esc(s) {
    var t = s == null ? '' : String(s);
    for (var i = 0; i < ESC.length; i++) { t = t.split(ESC[i][0]).join(ESC[i][1]); }
    return t;
  }
  function pad(v) { v = String(v); return v.length < 2 ? '0' + v : v; }
  function seoulParts(d) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d || new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return { y: o.year, m: pad(o.month), d: pad(o.day), hh: pad(o.hour === '24' ? '00' : o.hour), mm: pad(o.minute) };
  }
  function seoulDate(d) { var p = seoulParts(d); return p.y + '-' + p.m + '-' + p.d; }
  // 하루의 시작 시각(기본 4시) 전이면 전날로 본다(야근 고려, 기획안 1의 13장).
  function studyDate(dayStartHour) {
    var now = new Date();
    if (Number(seoulParts(now).hh) < Number(dayStartHour || 0)) { now = new Date(now.getTime() - 86400000); }
    return seoulDate(now);
  }
  function koDate(d) {
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' }).format(d || new Date());
  }
  function dots(d) { return String(d || '').split('-').join('.'); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function stamp() { var p = seoulParts(new Date()); return p.y + p.m + p.d + '-' + p.hh + p.mm; }
  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(r.error || new Error('파일을 읽지 못했습니다.')); };
      r.readAsText(file);
    });
  }
  // AI 답변에서 복사한 JSON 앞뒤의 코드 울타리를 걷어낸다.
  function stripFences(text) {
    var t = String(text || '').trim();
    var fence = '```';
    if (t.indexOf(fence) === 0) {
      var first = t.indexOf(NL);
      t = first < 0 ? '' : t.slice(first + 1);
      var last = t.lastIndexOf(fence);
      if (last >= 0) { t = t.slice(0, last); }
    }
    return t.trim();
  }
  function fmtBytes(n) {
    if (n == null || isNaN(n)) { return '알 수 없음'; }
    if (n < 1024) { return n + 'B'; }
    if (n < 1048576) { return (n / 1024).toFixed(1) + 'KB'; }
    if (n < 1073741824) { return (n / 1048576).toFixed(1) + 'MB'; }
    return (n / 1073741824).toFixed(2) + 'GB';
  }
  function clampInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) { return fallback; }
    return Math.max(min, Math.min(max, n));
  }
  window.PHD = window.PHD || {};
  window.PHD.util = {
    esc: esc, seoulDate: seoulDate, studyDate: studyDate, koDate: koDate, dots: dots, daysBetween: daysBetween,
    stamp: stamp, download: download, readFile: readFile, stripFences: stripFences, fmtBytes: fmtBytes, clampInt: clampInt
  };
})();
