/* 진우주 기자 학교 — 간격 반복 엔진(M2). 기획안 1의 11.1. 화면·저장과 분리된 순수 함수만 둔다.
   날짜는 학습일 문자열(YYYY-MM-DD), 학습 단계(분 단위 재출제)는 dueAt(ms)로 다룬다. */
(function (root) {
  'use strict';
  var DAY = 86400000;
  var LEARN_STEPS = [1, 10];          // 신규 카드 학습 단계(분). 마지막 단계를 넘으면 1일로 졸업.
  var RELEARN_MIN = 10;               // 복습 중 ‘다시’ → 세션 안 10분 뒤 재출제
  var EASE0 = 2.5, EASE_MIN = 1.3;
  var EASY_GRAD = 4;                  // 신규·학습 중 ‘쉬움’이면 4일로 바로 졸업(D018)
  var MAX_IVL = 120;
  var LEARN_AHEAD_MIN = 20;           // 세션을 열 때 20분 안에 돌아올 학습 카드는 함께 낸다
  var PHASES = ['discovery', 'preclinical', 'p1', 'p2', 'p3', 'approved', 'p4'];
  var PHASE_LABEL = { discovery: '탐색', preclinical: '전임상', p1: '1상', p2: '2상', p3: '3상', approved: '허가', p4: '시판 후' };

  function addDays(date, n) { return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY); }
  function clone(o) { var out = {}; Object.keys(o || {}).forEach(function (k) { out[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; }); return out; }

  function newProgress(card) {
    var d = (card && card.data) || {};
    return {
      id: card.id, courseId: card.courseId || 'pipeline', kind: 'card', state: 'new', step: 0,
      interval: 0, ease: EASE0, reps: 0, lapses: 0, due: '', dueAt: 0,
      phase: 'discovery', misconception: false, misconceptionAt: '', firstSeen: '', lastReview: '', correctDays: [],
      core: Array.isArray(d.tags) && d.tags.indexOf('core') >= 0
    };
  }

  function phaseIndex(p) { var i = PHASES.indexOf(p); return i < 0 ? 0 : i; }

  // 확신도 반영 뒤의 실제 평가. ‘모름’인데 정답이면 최대 ‘어려움’(운 좋은 정답 방지).
  function effectiveGrade(grade, confidence) {
    var g = Math.max(1, Math.min(4, Number(grade) || 1));
    if (confidence === 'unknown' && g >= 3) { g = 2; }
    return g;
  }

  function fuzz(ivl, rng) {
    if (ivl < 3) { return ivl; }
    var f = 0.95 + 0.1 * rng();
    return Math.max(3, Math.round(ivl * f));
  }

  // 복습 카드의 다음 간격(분산 전). 11.1 그대로.
  function reviewInterval(ivl, ease, g) {
    if (g === 1) { return { interval: 1, ease: Math.max(EASE_MIN, ease - 0.2) }; }
    if (g === 2) { return { interval: Math.max(1, Math.round(ivl * 1.2)), ease: Math.max(EASE_MIN, ease - 0.15) }; }
    if (g === 3) { return { interval: ivl <= 0 ? 1 : (ivl === 1 ? 3 : Math.round(ivl * ease)), ease: ease }; }
    return { interval: Math.max(1, Math.round(ivl * ease * 1.3)), ease: ease + 0.15 };
  }

  // 면접일 당기기: core 카드의 다음 복습이 면접일을 넘으면 면접 7~10일 전으로.
  function pullForInterview(p, today, interviewDate, rng) {
    if (!p.core || !interviewDate || !p.due || p.due <= interviewDate) { return; }
    var gap = diffDays(today, interviewDate);
    if (gap < 8) { return; }
    var back = Math.min(7 + Math.floor(rng() * 4), gap - 1);
    p.due = addDays(interviewDate, -back);
    p.interval = diffDays(today, p.due);
  }

  /* 한 번 평가한다. ctx: { today, now, confidence, maxInterval, interviewDate, rng }
     돌려줌: { progress, grade, correct, wasNew, requeueMin(세션 안 재출제, 없으면 0), demoted, misconception } */
  function answer(prev, grade, ctx) {
    ctx = ctx || {};
    var rng = ctx.rng || Math.random;
    var today = ctx.today, now = ctx.now || Date.now();
    var maxIvl = ctx.maxInterval || MAX_IVL;
    var p = clone(prev);
    var g = effectiveGrade(grade, ctx.confidence);
    var wasNew = p.state === 'new';
    var requeue = 0, demoted = false, newMis = false;

    if (!p.firstSeen) { p.firstSeen = today; }
    if (p.phase === 'discovery') { p.phase = 'preclinical'; }
    p.reps = (p.reps || 0) + 1;
    var lastBefore = p.lastReview;
    p.lastReview = today;

    function graduate(days) {
      p.state = 'review'; p.step = 0; p.interval = days; p.due = addDays(today, days); p.dueAt = 0;
    }

    if (p.state === 'new' || p.state === 'learning') {
      if (wasNew) { p.state = 'learning'; p.step = 0; }
      if (g === 1) { p.step = 0; requeue = LEARN_STEPS[0]; }
      else if (g === 2) { requeue = LEARN_STEPS[Math.min(p.step, LEARN_STEPS.length - 1)]; }
      else if (g === 3) {
        p.step += 1;
        if (p.step >= LEARN_STEPS.length) { graduate(1); } else { requeue = LEARN_STEPS[p.step]; }
      } else { graduate(EASY_GRAD); }
    } else if (p.state === 'relearning') {
      if (g === 1) { requeue = RELEARN_MIN; }
      else { p.state = 'review'; p.due = addDays(today, Math.max(1, p.interval)); p.dueAt = 0; }
    } else {
      var r = reviewInterval(p.interval || 0, p.ease || EASE0, g);
      p.ease = Math.round(r.ease * 100) / 100;
      if (g === 1) {
        p.lapses = (p.lapses || 0) + 1;
        p.interval = 1;
        p.state = 'relearning';
        requeue = RELEARN_MIN;
        p.due = addDays(today, 1);
        var pi = phaseIndex(p.phase);
        if (p.phase === 'p4') { p.phase = 'p2'; demoted = true; }
        else if (pi > 2) { p.phase = PHASES[pi - 1]; demoted = true; }
      } else {
        p.interval = Math.min(maxIvl, fuzz(Math.min(maxIvl, r.interval), rng));
        p.due = addDays(today, p.interval);
        p.dueAt = 0;
        pullForInterview(p, today, ctx.interviewDate, rng);
      }
    }
    if (requeue) { p.dueAt = now + requeue * 60000; if (!p.due || p.state !== 'relearning') { p.due = today; } }

    var correct = g >= 3;
    // 확신도: ‘확실’인데 오답 → 착각 카드(최우선, 다음날 강제 재출제).
    if (ctx.confidence === 'sure' && g === 1) { p.misconception = true; p.misconceptionAt = today; newMis = true; }
    else if (p.misconception && correct && p.misconceptionAt && p.misconceptionAt < today) { p.misconception = false; }
    if (correct) {
      p.correctDays = (p.correctDays || []).filter(function (d) { return d !== today; }).concat([today]).slice(-30);
      // 1상: 노출 후 하루 이상 지난 뒤 첫 정답(11.2). 2상 이후는 문항·시험 단계(M4·M6)에서.
      if (p.phase === 'preclinical' && p.firstSeen < today) { p.phase = 'p1'; }
    }
    void lastBefore;
    return { progress: p, grade: g, correct: correct, wasNew: wasNew, requeueMin: requeue, demoted: demoted, misconception: newMis };
  }

  function fmtInterval(min, days) {
    if (min) { return min + '분'; }
    if (days < 30) { return days + '일'; }
    var m = days / 30;
    return (m < 10 ? Math.round(m * 10) / 10 : Math.round(m)) + '개월';
  }

  // 평가 버튼 아래 다음 간격 미리보기(분산 전 값).
  function preview(prev, ctx) {
    var c = { today: ctx.today, now: ctx.now, confidence: ctx.confidence, maxInterval: ctx.maxInterval, rng: function () { return 0.5; } };
    return [1, 2, 3, 4].map(function (g) {
      var r = answer(prev, g, c);
      return fmtInterval(r.requeueMin, r.progress.interval);
    });
  }

  function isDue(p, today, now) {
    if (!p || p.state === 'new') { return false; }
    if (p.state === 'learning' || p.state === 'relearning') { return (p.dueAt || 0) <= now + LEARN_AHEAD_MIN * 60000 || (p.due && p.due < today); }
    return !!p.due && p.due <= today;
  }

  /* 오늘 세션 대기열. opts: { today, now, maxReviews, reviewsDone, newLimit, newDone, onlyIds }
     순서(8.2): 학습 단계 카드 → 착각 카드 → 위험도 높은 밀린 복습 → 나머지 복습 → 신규. */
  function buildQueue(cards, progressById, opts) {
    var today = opts.today, now = opts.now || Date.now();
    var only = opts.onlyIds ? {} : null;
    if (only) { opts.onlyIds.forEach(function (id) { only[id] = true; }); }
    var learning = [], review = [], fresh = [];
    cards.forEach(function (c) {
      if (only && !only[c.id]) { return; }
      var p = progressById[c.id];
      if (!p || p.state === 'new') { fresh.push(c.id); return; }
      if (!isDue(p, today, now)) { return; }
      if (p.state === 'review') { review.push(p); } else { learning.push(p); }
    });
    learning.sort(function (a, b) { return (a.dueAt || 0) - (b.dueAt || 0); });
    function risk(p) { return (diffDays(p.due, today) + 1) / Math.max(1, p.interval || 1); }
    review.sort(function (a, b) {
      if (!!b.misconception !== !!a.misconception) { return b.misconception ? 1 : -1; }
      return risk(b) - risk(a) || (a.id < b.id ? -1 : 1);
    });
    var reviewCap = Math.max(0, (opts.maxReviews == null ? 80 : opts.maxReviews) - (opts.reviewsDone || 0));
    var reviewIds = review.slice(0, reviewCap).map(function (p) { return p.id; });
    var newCap = Math.max(0, (opts.newLimit == null ? 8 : opts.newLimit) - (opts.newDone || 0));
    var freshIds = fresh.slice(0, newCap);
    var mis = review.filter(function (p) { return p.misconception; }).length;
    return {
      ids: learning.map(function (p) { return p.id; }).concat(reviewIds, freshIds),
      learning: learning.length, review: reviewIds.length, reviewTotal: review.length, fresh: freshIds.length, freshAvailable: fresh.length, misconceptions: mis
    };
  }

  // 향후 days일 동안 날마다 만기가 되는 복습 카드 수.
  function forecast(progressList, today, days) {
    var out = [];
    for (var i = 1; i <= (days || 7); i++) { out.push(0); }
    progressList.forEach(function (p) {
      if (!p || p.state === 'new' || !p.due) { return; }
      var d = diffDays(today, p.due);
      if (d >= 1 && d <= out.length) { out[d - 1] += 1; }
    });
    return out;
  }

  // 부하 관리: 향후 7일 중 하루라도 최대 복습 수의 1.5배를 넘으면 신규를 50% 줄인다.
  function adjustNewLimit(base, fc, maxReviews) {
    var peak = Math.max.apply(null, [0].concat(fc || []));
    var over = peak > 1.5 * (maxReviews || 80);
    return { limit: over ? Math.floor(base / 2) : base, reduced: over, peak: peak };
  }

  // 기억 강도(도감 별): -1 미발견, 0 익히는 중, 1~4 간격 기준.
  function strength(p) {
    if (!p || p.state === 'new') { return -1; }
    if (p.state !== 'review') { return 0; }
    var i = p.interval || 0;
    return i >= 60 ? 4 : (i >= 21 ? 3 : (i >= 7 ? 2 : 1));
  }

  var api = {
    LEARN_STEPS: LEARN_STEPS, PHASES: PHASES, PHASE_LABEL: PHASE_LABEL, MAX_IVL: MAX_IVL, EASE0: EASE0, EASE_MIN: EASE_MIN,
    newProgress: newProgress, answer: answer, preview: preview, effectiveGrade: effectiveGrade, isDue: isDue,
    buildQueue: buildQueue, forecast: forecast, adjustNewLimit: adjustNewLimit, strength: strength,
    addDays: addDays, diffDays: diffDays, fmtInterval: fmtInterval
  };
  root.PHD = root.PHD || {};
  root.PHD.srs = api;
})(typeof window !== 'undefined' ? window : globalThis);
