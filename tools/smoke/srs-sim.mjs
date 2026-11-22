// 복습 엔진(M2) 30일 가상 진행 시뮬레이션. 기획안 1의 11.1과 간격·만기 계산이 같은지 본다.
// 실행: cd tools/smoke && node srs-sim.mjs (smoke.mjs도 이 검사를 먼저 돌린다)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(here, '..', '..', 'site', 'js', 'srs.js'), 'utf8');
const sandbox = { globalThis: null };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const R = sandbox.PHD.srs;

const failures = [];
function check(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); } else { failures.push(msg); console.log('  ✕ ' + msg); }
}
const mid = () => 0.5;               // 분산 없음(0.95 + 0.1 × 0.5 = 1.0)
const D0 = '2026-12-07';
const day = (n) => R.addDays(D0, n);
const card = (id, core) => ({ id, courseId: 'pipeline', data: { tags: core ? ['core'] : [] } });
let clock = Date.parse('2026-12-07T01:00:00Z');
function ans(p, g, today, conf, extra) {
  clock += 60000;
  return R.answer(p, g, Object.assign({ today, now: clock, confidence: conf || 'unsure', rng: mid }, extra || {}));
}

console.log('1. 카드 A — 늘 알맞음');
let a = R.newProgress(card('A'));
let r = ans(a, 3, day(0)); a = r.progress;
check(a.state === 'learning' && r.requeueMin === 10 && r.wasNew, '신규 → 1분 단계 통과, 10분 뒤 재출제');
r = ans(a, 3, day(0)); a = r.progress;
check(a.state === 'review' && a.interval === 1 && a.due === day(1), '10분 단계 통과 → 1일 졸업');
r = ans(a, 3, day(1)); a = r.progress;
check(a.interval === 3 && a.due === day(4), '간격 1 → 3일');
r = ans(a, 3, day(4)); a = r.progress;
check(a.interval === 8 && a.due === day(12), '간격 3 × 2.5 = 7.5 → 8일');
r = ans(a, 3, day(12)); a = r.progress;
check(a.interval === 20 && a.due === day(32) && a.ease === 2.5, '간격 8 × 2.5 = 20일, ease 유지');
check(a.phase === 'p1', '노출 다음 날 정답 → 1상(11.2)');

console.log('2. 카드 B — 쉬움·다시·어려움·쉬움');
let b = R.newProgress(card('B'));
b = ans(b, 4, day(0)).progress;
check(b.state === 'review' && b.interval === 4 && b.due === day(4), '신규 쉬움 → 4일 졸업');
r = ans(b, 1, day(4)); b = r.progress;
check(b.state === 'relearning' && b.lapses === 1 && b.ease === 2.3 && b.interval === 1 && r.requeueMin === 10, '다시: lapses +1, ease −0.20, 간격 1일, 10분 뒤 재출제');
b = ans(b, 3, day(4)).progress;
check(b.state === 'review' && b.due === day(5), '재학습 통과 → 다음날');
b = ans(b, 3, day(5)).progress;
check(b.interval === 3 && b.due === day(8), '간격 1 → 3일');
b = ans(b, 2, day(8)).progress;
check(b.interval === 4 && b.ease === 2.15 && b.due === day(12), '어려움: round(3 × 1.2) = 4일, ease −0.15');
b = ans(b, 4, day(12)).progress;
check(b.interval === 11 && b.ease === 2.3 && b.due === day(23), '쉬움: round(4 × 2.15 × 1.3) = 11일, ease +0.15');
b = ans(b, 3, day(23)).progress;
check(b.interval === 25 && b.due === day(48), '알맞음: round(11 × 2.3) = 25일');

console.log('3. 확신도');
let c = R.newProgress(card('C'));
r = ans(c, 1, day(0), 'sure'); c = r.progress;
check(c.misconception && r.misconception && r.requeueMin === 1, '확실인데 오답 → 착각 카드, 1분 뒤 재출제');
c = ans(c, 3, day(0)).progress; c = ans(c, 3, day(0)).progress;
check(c.due === day(1) && c.misconception, '착각 표시 유지, 다음날 강제 재출제');
r = ans(c, 4, day(1), 'unknown'); c = r.progress;
check(r.grade === 2 && c.interval === 1 && c.ease === 2.35, '모름인데 쉬움 → 어려움으로 제한');
c = ans(c, 3, day(2), 'sure').progress;
check(!c.misconception && c.interval === 3, '다른 날 정답 → 착각 해제');

console.log('4. 한계값');
let e = Object.assign(R.newProgress(card('E')), { state: 'review', interval: 3, ease: 1.4, due: day(0), phase: 'p1' });
e = ans(e, 1, day(0)).progress;
check(e.ease === 1.3, 'ease 최저 1.3');
let m = Object.assign(R.newProgress(card('M')), { state: 'review', interval: 100, ease: 2.5, due: day(0), phase: 'p3' });
r = ans(m, 3, day(0));
check(r.progress.interval === 120, '최대 간격 120일');
r = ans(m, 1, day(0));
check(r.progress.phase === 'p2' && r.demoted, '다시 → 한 단계 강등(안전성 신호)');
r = ans(Object.assign({}, m, { phase: 'p4' }), 1, day(0));
check(r.progress.phase === 'p2', '시판 후 오답 → 2상 강등');
r = ans(Object.assign({}, m, { phase: 'p1' }), 1, day(0));
check(r.progress.phase === 'p1' && !r.demoted, '1상 아래로는 내려가지 않음');
let lo = 99, hi = 0;
for (let i = 0; i < 300; i++) {
  const f = R.answer(Object.assign({}, m, { interval: 8 }), 3, { today: day(0), now: clock, confidence: 'unsure', rng: Math.random }).progress.interval;
  lo = Math.min(lo, f); hi = Math.max(hi, f);
}
check(lo >= 19 && hi <= 21 && hi > lo, '간격 3일 이상 ±5% 분산(20 → ' + lo + '~' + hi + ')');
const pre = R.preview(Object.assign({}, m, { interval: 8, phase: 'p1' }), { today: day(0), now: clock });
check(pre.join(',') === '10분,10일,20일,26일', '평가 버튼 다음 간격 미리보기 ' + pre.join(','));
const preNew = R.preview(R.newProgress(card('N')), { today: day(0), now: clock });
check(preNew.join(',') === '1분,1분,10분,4일', '신규 카드 미리보기 ' + preNew.join(','));

console.log('5. 면접일 당기기');
const iv = '2027-04-01';
const core = Object.assign(R.newProgress(card('K', true)), { state: 'review', interval: 30, ease: 2.5, due: '2027-03-01', phase: 'p1' });
for (let i = 0; i < 20; i++) {
  const p2 = R.answer(core, 3, { today: '2027-03-01', now: clock, interviewDate: iv, rng: Math.random }).progress;
  if (!(p2.due >= '2027-03-22' && p2.due <= '2027-03-25')) { failures.push('면접 당기기 범위 ' + p2.due); }
}
check(true, 'core 카드가 면접일을 넘으면 면접 7~10일 전으로');
const notCore = R.answer(Object.assign({}, core, { core: false }), 3, { today: '2027-03-01', now: clock, interviewDate: iv, rng: mid }).progress;
check(notCore.due === '2027-05-15', 'core가 아니면 그대로');

console.log('6. 대기열·부하 관리');
const cards = ['R1', 'R2', 'R3', 'N1', 'N2', 'N3'].map((id) => card(id));
const prog = {
  R1: { id: 'R1', state: 'review', interval: 10, due: day(9) },
  R2: { id: 'R2', state: 'review', interval: 2, due: day(8) },
  R3: { id: 'R3', state: 'review', interval: 30, due: day(5), misconception: true }
};
let q = R.buildQueue(cards, prog, { today: day(10), now: clock, maxReviews: 80, newLimit: 2 });
check(q.ids.join(',') === 'R3,R2,R1,N1,N2', '착각 → 위험도(밀린 날 ÷ 간격) 순 → 신규(한도 2) ' + q.ids.join(','));
q = R.buildQueue(cards, prog, { today: day(10), now: clock, maxReviews: 80, reviewsDone: 78, newLimit: 2, newDone: 2 });
check(q.review === 2 && q.fresh === 0, '하루 최대 복습·신규 한도');
const many = [];
for (let i = 0; i < 130; i++) { many.push({ state: 'review', due: day(3) }); }
const fc = R.forecast(many, day(0), 7);
const adj = R.adjustNewLimit(8, fc, 80);
check(fc[2] === 130 && adj.reduced && adj.limit === 4, '7일 예측이 최대 복습의 1.5배 초과 → 신규 50%');
check(!R.adjustNewLimit(8, [10, 20], 80).reduced, '여유 있으면 그대로');

console.log('7. 30일 가상 진행(카드 30장, 하루 신규 8, 참조 구현과 비교)');
function refInterval(ivl, ease, g) {   // 11.1을 그대로 옮긴 참조 구현
  if (g === 1) { return [1, Math.max(1.3, ease - 0.2)]; }
  if (g === 2) { return [Math.max(1, Math.round(ivl * 1.2)), Math.max(1.3, ease - 0.15)]; }
  if (g === 3) { return [ivl === 0 ? 1 : ivl === 1 ? 3 : Math.round(ivl * ease), ease]; }
  return [Math.round(ivl * ease * 1.3), ease + 0.15];
}
const deck = [];
for (let i = 1; i <= 30; i++) { deck.push(card('W01-C' + String(i).padStart(3, '0'), i % 3 === 0)); }
const P = {};
let mismatches = 0, reviews = 0, lapses = 0, maxDay = 0;
const daily = [];
for (let d = 0; d < 30; d++) {
  const today = day(d);
  const qq = R.buildQueue(deck, P, { today, now: clock, maxReviews: 80, newLimit: 8 });
  const queue = qq.ids.slice();
  let done = 0;
  let guard = 0;
  while (queue.length && guard++ < 500) {
    const id = queue.shift();
    const prev = P[id] || R.newProgress(deck.find((x) => x.id === id));
    const seed = (id.charCodeAt(id.length - 1) * 7 + d * 13 + (prev.reps || 0) * 5) % 10;
    const g = seed === 0 ? 1 : seed === 1 ? 2 : seed === 9 ? 4 : 3;
    const res = ans(prev, g, today);
    if (prev.state === 'review') {
      reviews += 1;
      const exp = refInterval(prev.interval, prev.ease, g);
      const expIvl = g === 1 ? 1 : Math.min(120, exp[0]);
      const expDue = R.addDays(today, expIvl);
      if (res.progress.interval !== expIvl || res.progress.due !== expDue || Math.abs(res.progress.ease - exp[1]) > 1e-9) {
        mismatches += 1;
        console.log('    불일치 ' + id + ' ' + today + ' g' + g + ' 기대 ' + expIvl + '/' + expDue + ' 실제 ' + res.progress.interval + '/' + res.progress.due);
      }
      if (g === 1) { lapses += 1; }
    }
    P[id] = res.progress;
    if (res.requeueMin) { queue.push(id); }
    done += 1;
  }
  daily.push(qq.review + '+' + qq.fresh);
  maxDay = Math.max(maxDay, qq.review);
}
const allSeen = Object.keys(P).length;
console.log('    날마다 복습+신규: ' + daily.join(' '));
check(mismatches === 0, '복습 ' + reviews + '회 모두 11.1 간격·만기와 일치(다시 ' + lapses + '회 포함)');
check(allSeen === 30, '4일째까지 30장 모두 신규 투입(하루 8장)');
check(Object.values(P).every((p) => p.state === 'review' || p.state === 'relearning'), '30일 뒤 모든 카드가 복습 상태');
check(Object.values(P).every((p) => p.due > day(29) || p.due === day(29) || p.state === 'relearning'), '30일째 대기열을 모두 처리');

if (failures.length) { console.log('복습 엔진 시뮬레이션 실패 ' + failures.length + '건'); process.exit(1); }
console.log('복습 엔진 시뮬레이션 통과');
