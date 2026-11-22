// 개발용 브라우저 흉내 검사(jsdom + fake-indexeddb). 배포본에는 포함되지 않는다(D011).
// 실행: cd tools/smoke && npm ci && node srs-sim.mjs && node smoke.mjs
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdomPkg from 'jsdom';

const { JSDOM, VirtualConsole } = jsdomPkg;
const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..', '..', 'site');
const NL = String.fromCharCode(10);
const failures = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function check(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); } else { failures.push(msg); console.log('  ✕ ' + msg); }
}
async function until(fn, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await fn()) { return true; } } catch (e) { /* 다시 시도 */ }
    await wait(25);
  }
  return false;
}

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const m = String((e && e.message) || e);
  if (m.indexOf('navigation') < 0) { pageErrors.push(m); }
});
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
w.indexedDB = globalThis.indexedDB;
w.IDBKeyRange = globalThis.IDBKeyRange;
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.scrollTo = () => {};
w.confirm = () => true;
w.URL.createObjectURL = () => 'blob:test';
w.URL.revokeObjectURL = () => {};
w.fetch = async (url) => {
  const file = path.join(site, String(url).split('?')[0]);
  if (!fs.existsSync(file)) { return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; }
  const text = fs.readFileSync(file, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};
w.addEventListener('error', (e) => pageErrors.push('error: ' + (e.message || e)));
w.addEventListener('unhandledrejection', (e) => pageErrors.push('unhandled: ' + ((e.reason && e.reason.message) || e.reason)));

const order = [...html.matchAll(/src='js[/]([a-z]+[.]js)'/g)].map((m) => m[1]);
for (const f of order) { w.eval(fs.readFileSync(path.join(site, 'js', f), 'utf8')); }

const doc = w.document;
const S = w.PHD.store;
const P = w.PHD.packs;
const G = w.PHD.game;
const main = () => doc.getElementById('main').textContent;
const playBox = () => doc.getElementById('play');
const nav = async (hash) => { w.location.hash = hash; await wait(40); };
const key = (k) => doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const setInput = (id, v) => { const i = doc.getElementById(id); i.value = v; i.dispatchEvent(new w.Event('change', { bubbles: true })); };
const today = () => w.PHD.util.studyDate(4);

console.log('0. 스크립트 순서');
check(order.join(',') === 'util.js,store.js,packs.js,srs.js,game.js,play.js,screens.js,app.js', 'index.html 스크립트 8개 ' + order.join(','));

console.log('1. 첫 화면(게임 홈)');
check(await until(() => doc.querySelector('.stage .char')), '홈에 캐릭터가 보인다');
check(await until(() => main().indexOf('취재 카드가 아직 없어요') >= 0), '빈 상태 말풍선');
check(!!doc.querySelector('.play-btn[data-action=load-builtin]'), '빈 상태 주 행동 = 기본 콘텐츠 받기');
check(doc.querySelectorAll('.tab').length === 4, '탭 4개(홈·지도·도감·나)');
check(doc.title === '진우주 기자 학교' && doc.getElementById('tabbar').textContent.indexOf('진우주 기자 학교') >= 0, '앱 이름 진우주 기자 학교');
check(main().indexOf('수습기자') >= 0 && main().indexOf('Lv 1') >= 0, '연차·레벨 표시(수습기자 Lv 1)');

console.log('2. 샘플 불러오기');
doc.querySelector('[data-action=load-sample]').click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('새로 ') >= 0), '가져오기 결과 시트');
const sum1 = await P.summary();
check(sum1.packs === 1 && sum1.kinds.card === 6 && sum1.kinds.item === 6 && sum1.kinds.lesson === 1, '팩 1 · 카드 6 · 문항 6 · 레슨 1 저장');
doc.querySelector('[data-action=sheet-close]').click();
check(doc.getElementById('sheet').hidden === true, '시트 닫힘');

console.log('3. 같은 팩 다시 가져오기');
await S.putMany('progress', [{ id: 'SAMPLE-C1', courseId: 'pipeline', phase: 'p1' }]);
const sampleText = fs.readFileSync(path.join(site, 'packs', 'sample.json'), 'utf8');
const r2 = await P.importPack(JSON.parse(sampleText), 'again');
check(r2.ok && r2.added === 0 && r2.updated > 0, '중복 없이 갱신');
const prog = await S.get('progress', 'SAMPLE-C1');
check(prog && prog.phase === 'p1', '학습 기록 보존');
await S.del('progress', 'SAMPLE-C1');

console.log('4. 파트 파일 병합');
const r3 = await P.importPack({ packId: 'SAMPLE-W01', cards: [{ id: 'SAMPLE-C7', front: '추가 카드', back: '파트 2' }] }, 'part2');
const meta = await S.get('packs', 'SAMPLE-W01');
check(r3.ok && meta.counts.card === 7 && meta.title.indexOf('샘플') === 0 && meta.courseId === 'pipeline' && meta.week === 1, '파트 병합 시 메타 유지·개수 갱신');

console.log('5. 잘못된 입력');
check(!(await P.importPack([], 'arr')).ok, '배열 파일 거부');
check(!(await P.importPack({ title: 'x', cards: [] }, 'nopack')).ok, 'packId 없음 거부');
check(!(await P.importPack({ packId: 'X', courseId: 'other', cards: [] }, 'course')).ok, '잘못된 courseId 거부');
check(!(await P.importPack({ app: 'pharma-health-desk', kind: 'backup' }, 'bk')).ok, '백업 파일을 팩으로 가져오기 거부');

console.log('6. 화면 이동');
await nav('#/pipeline');
check(await until(() => main().indexOf('신약은 어떤 길을 지나 환자에게 가나') >= 0 && doc.querySelector('.node[data-action=node]')), '지도에 레슨 칸');
check(await until(() => !!doc.querySelector('.node.boss') && main().indexOf('주간 미니 시험') >= 0), '지도에 보스(시험) 칸');
check(!!doc.querySelector('.node.current') && main().indexOf('여기부터') >= 0, '지금 할 칸 표시');
await nav('#/review');
check(await until(() => doc.querySelectorAll('.tile').length === 7), '도감 카드 7장');
check(doc.querySelectorAll('.tile.unseen').length === 7 && main().indexOf('0/ 7 발견') >= 0, '처음엔 모두 미발견');
await nav('#/exam');
check(await until(() => w.location.hash === '#/exam' && !!doc.querySelector('.node.boss')), '옛 시험 주소는 지도로');
await nav('#/me');
check(await until(() => !!doc.querySelector('.profile .char') && main().indexOf('진우주') >= 0), '나: 프로필 캐릭터·이름');
check(doc.querySelectorAll('.gi').length === 9 && doc.querySelectorAll('.gi.on').length === 1, '장비 9개 중 1개 해금');
check(doc.querySelectorAll('.heat i').length === 84, '출석부 12주');
await nav('#/me/settings');
check(await until(() => main().indexOf('SAMPLE-W01') >= 0 && main().indexOf('백업 내보내기') >= 0), '설정: 팩 목록·백업');
await nav('#/me/dev');
check(await until(() => main().indexOf('설치 단계') >= 0 && main().indexOf('앱 골격') >= 0), '개발 현황');
check(main().indexOf('8a. O1') >= 0 && main().indexOf('14a. O2') >= 0, '개발 현황에 온라인 단계 번호');
await nav('#/nothing');
check(await until(() => !!doc.querySelector('.stage')), '모르는 주소는 홈으로');

console.log('7. 설정');
await nav('#/me/settings');
await until(() => doc.querySelector('[data-key=theme][data-val=dark]'));
doc.querySelector('[data-key=theme][data-val=dark]').click();
check(await until(() => doc.documentElement.getAttribute('data-theme') === 'dark'), '다크 테마 적용');
check(JSON.parse(w.localStorage.getItem('phd.settings')).theme === 'dark', '설정 저장');
await until(() => doc.querySelector('[data-key=fontScale]'));
[...doc.querySelectorAll('[data-key=fontScale]')].filter((b) => b.getAttribute('data-val') === '1.15')[0].click();
check(await until(() => doc.documentElement.style.fontSize === '18.4px'), '글자 크기 적용');
await until(() => doc.getElementById('set-new'));
setInput('set-new', '999');
check(await until(() => S.loadSettings().dailyNew === 50), '숫자 설정 범위 제한');
setInput('set-new', '8');
setInput('set-nick', '우주기자');
check(await until(() => S.loadSettings().nickname === '우주기자'), '캐릭터 이름 저장');
await until(() => doc.querySelector('[data-key=sound][data-val=false]'));
doc.querySelector('[data-key=sound][data-val=false]').click();
check(await until(() => S.loadSettings().sound === false), '효과음 끄기 저장');

console.log('8. 백업·초기화·복원');
const backup = await S.exportAll(S.loadSettings());
const n0 = await S.count('content');
check(n0 > 0 && backup.stores.content.length === n0, '백업에 모든 콘텐츠 포함');
check(S.validateBackup(backup).errors.length === 0, '백업 검사 통과');
await S.resetAll();
check((await S.count('content')) === 0 && S.loadSettings().theme === 'auto', '초기화');
const res = await S.restoreAll(JSON.parse(JSON.stringify(backup)));
check(res.skipped === 0 && (await S.count('content')) === n0, '복원 후 콘텐츠 일치');
check(S.loadSettings().theme === 'dark' && S.loadSettings().nickname === '우주기자', '복원 후 설정 일치');
check(S.validateBackup({ app: 'x' }).errors.length > 0, '다른 파일 복원 거부');
check(S.validateBackup(Object.assign({}, backup, { schemaVersion: 99 })).errors.length > 0, '새 버전 백업 거부');

console.log('9. 붙여넣기(코드 울타리)');
await nav('#/me/settings');
await until(() => doc.querySelector('[data-action=import-paste]'));
doc.querySelector('[data-action=import-paste]').click();
await until(() => doc.getElementById('paste-box'));
const fenced = '```json' + NL + JSON.stringify({ packId: 'PASTE-1', courseId: 'healthbeat', cards: [{ id: 'P-C1', front: 'a', back: 'b' }] }) + NL + '```';
doc.getElementById('paste-box').value = fenced;
doc.querySelector('[data-action=paste-import]').click();
check(await until(async () => !!(await S.get('packs', 'PASTE-1'))), '울타리 붙은 JSON 가져오기');
check((await S.get('packs', 'PASTE-1')).courseId === 'healthbeat', 'courseId 유지');
doc.querySelector('[data-action=sheet-close]').click();

console.log('10. 팩 삭제');
await nav('#/today');
await nav('#/me/settings');
check(await until(() => doc.querySelector('[data-action=delete-pack][data-id=PASTE-1]')), '삭제 버튼 표시');
doc.querySelector('[data-action=delete-pack][data-id=PASTE-1]').click();
check(await until(async () => !(await S.get('packs', 'PASTE-1'))), '팩 삭제');

console.log('11. 원본 팩 가져오기');
const root = path.resolve(here, '..', '..');
const packFiles = [];
const walkJson = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { walkJson(p); } else if (f.name.endsWith('.json')) { packFiles.push(p); } } };
if (fs.existsSync(path.join(root, 'data'))) { walkJson(path.join(root, 'data')); }
for (const f of packFiles) {
  const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (Array.isArray(obj) || !obj.packId) { continue; }
  const r = await P.importPack(obj, path.basename(f));
  check(r.ok && r.added + r.updated > 0, path.relative(root, f) + ' 가져오기(' + (r.ok ? r.added + r.updated : r.errors.join(', ')) + ')');
}
const w00 = await S.get('packs', 'W00-diagnostic');
check(!w00 || (w00.counts && w00.counts.item === 95 && w00.counts.exam === 1), 'W00 진단평가 문항 95 · 시험 1 저장');
const reg = await S.get('packs', 'HB-REG-001');
check(!reg || (reg.courseId === 'healthbeat' && reg.counts && reg.counts.stat === 34), '통계 시드 34건이 코스 2로 저장');

console.log('12. 홈·키보드(D016·D018)');
await nav('#/today');
check(await until(() => doc.querySelector('.play-btn[data-action=play]')), '홈 주 행동 = 취재 시작(하나)');
check(doc.querySelectorAll('.main .play-btn').length === 1, '홈의 큰 버튼은 하나');
check(doc.querySelectorAll('.quest').length === 3 && doc.querySelectorAll('.wd').length === 7, '오늘의 퀘스트 3개·주간 출석 7칸');
check(!!doc.querySelector('.dday'), '다음 일정 D-day');
key('2');
check(await until(() => w.location.hash.indexOf('pipeline') >= 0), '숫자 키 2로 지도');
key('1');
check(await until(() => w.location.hash.indexOf('today') >= 0), '숫자 키 1로 홈');
check(doc.querySelectorAll('.tab kbd').length === 4, '탭마다 단축키 표시');

console.log('13. 기본 콘텐츠 불러오기·감수 전 표시(D017)');
for (const id of ['W00-diagnostic', 'W01-pipeline-map', 'HB-REG-001']) { await P.deletePack(id); }
await nav('#/me/settings');
check(await until(() => doc.querySelector('[data-action=load-builtin]')), '기본 콘텐츠 불러오기 버튼');
doc.querySelector('[data-action=load-builtin]').click();
check(await until(async () => !!(await S.get('packs', 'W00-diagnostic')) && !!(await S.get('packs', 'W01-pipeline-map')) && !!(await S.get('packs', 'HB-REG-001')), 5000), '기본 팩 3개 불러오기');
check((await S.get('packs', 'W01-pipeline-map')).review === 'draft', '감수 상태 저장');
const shc = doc.querySelector('[data-action=sheet-close]'); if (shc) { shc.click(); }
await nav('#/today'); await nav('#/me/settings');
check(await until(() => main().indexOf('감수 전') >= 0), '설정에 감수 전 표시');

console.log('14. 취재 세션 — 복습 엔진(M2)·게임');
await nav('#/today');
await until(() => doc.querySelector('.play-btn[data-action=play]'));
check(main().indexOf('새 카드 8') >= 0, '오늘 새 카드 8장 안내');
key('Enter');
check(await until(() => !playBox().hidden && doc.body.classList.contains('playing') && doc.querySelector('.pl-q')), 'Enter로 취재 시작, 카드 앞면');
check(doc.querySelectorAll('.cbtn').length === 3 && !!doc.querySelector('.tag.new'), '확신도 버튼 3개·NEW 표시');
key('w');
check(await until(() => doc.querySelectorAll('.gbtn').length === 4), '확신도로 뒤집기 → 평가 버튼 4개');
const ivs = [...doc.querySelectorAll('.gbtn small')].map((s) => s.textContent).join(',');
check(ivs === '1분,1분,10분,4일', '다음 간격 미리보기 ' + ivs);
const firstId = w.PHD.play.active() && doc.querySelector('.pl-q').textContent;
key('3');
check(await until(async () => (await S.getAll('progress')).some((p) => p.kind === 'card' && p.state === 'learning')), '알맞음 → 학습 단계 저장');
let steps = 0;
while (steps++ < 60 && !doc.querySelector('.rs-title')) {
  await until(() => doc.querySelector('.cbtn') || doc.querySelector('.gbtn') || doc.querySelector('.rs-title'), 2000);
  if (doc.querySelector('.cbtn')) { key('e'); await until(() => doc.querySelector('.gbtn'), 1000); }
  if (doc.querySelector('.gbtn')) { key('4'); await wait(300); }
}
check(await until(() => doc.querySelector('.rs-title') && doc.querySelector('.rs-title').textContent === '취재 완료'), '결과 화면: 취재 완료');
const g1 = (await G.load(today())).game;
const log1 = (await G.load(today())).log;
check(log1.fresh === 8 && log1.reviews === 0, '하루 새 카드 8장 기록');
check(g1.xp === log1.xp && g1.xp >= 16 && g1.xp <= 60, 'XP 저장(새 카드 2×8 + 특종·퀘스트 보너스): ' + g1.xp);
check(g1.streak === 1 && log1.qualified, '연속 학습일 1일(대기열 0)');
const prog8 = (await S.getAll('progress')).filter((p) => p.kind === 'card');
check(prog8.length === 8 && prog8.every((p) => p.state === 'review' && p.phase === 'preclinical'), '카드 8장 복습 상태·전임상');
const atts = await S.getAll('attempts');
check(atts.length === 9 && atts.every((a) => a.confidence && a.effectiveGrade), '평가 기록 9건(확신도 포함)');
check(doc.querySelector('.rs-xp b') && doc.querySelectorAll('.rs-stats div').length === 4, '결과 XP·통계 4개');
key('Enter');
check(await until(() => playBox().hidden && !doc.body.classList.contains('playing')), 'Enter로 결과 닫기');
check(await until(() => doc.querySelector('.play-btn[data-action=extra-new]')), '오늘 할 일 끝 → 새 카드 5장 더');
check(doc.querySelectorAll('.quest.done').length >= 2, '퀘스트 달성 표시');
check(!!doc.querySelector('.chip.streak.on'), '연속일 불꽃 켜짐');

console.log('15. 확신도 제한·중간 종료');
doc.querySelector('.play-btn[data-action=extra-new]').click();
check(await until(() => doc.querySelector('.pl-q')), '추가 새 카드로 취재');
key('q');
await until(() => doc.querySelector('.gbtn'));
key('4');
await wait(350);
const lastAtt = (await S.getAll('attempts')).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
check(lastAtt.confidence === 'unknown' && lastAtt.grade === 4 && lastAtt.effectiveGrade === 2, '모름 + 쉬움 → 어려움으로 기록');
key('Escape');
check(await until(() => doc.querySelector('.rs-title')), 'Esc로 그만하기 → 결과');
key('Escape');
check(await until(() => playBox().hidden), '결과에서 Esc로 닫기');

console.log('16. 지도에서 레슨 카드로 취재·도감');
await nav('#/pipeline');
await until(() => doc.querySelector('.node.current'));
doc.querySelector('.node.current').click();
check(await until(() => doc.querySelector('[data-action=play-lesson]') && doc.getElementById('sheet').textContent.indexOf('장') >= 0), '지금 할 레슨 시트: 이 레슨 카드로 취재 · n장');
doc.querySelector('[data-action=play-lesson]').click();
check(await until(() => !playBox().hidden && doc.querySelector('.pl-q')), '레슨 카드 취재 시작');
key('Escape');
check(await until(() => playBox().hidden), '한 장도 안 풀고 Esc → 바로 닫힘');
await nav('#/review');
check(await until(() => doc.querySelectorAll('.tile').length > 30 && doc.querySelectorAll('.tile:not(.unseen)').length === 9), '도감: 만난 카드 9장 열림');
doc.querySelector('.tile:not(.unseen)').click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('다음 복습') >= 0), '카드 시트: 다음 복습·간격');
doc.querySelector('[data-action=sheet-close]').click();
doc.querySelector('[data-action=dex-filter][data-val=unseen]').click();
check(await until(() => doc.querySelectorAll('.tile').length > 0 && doc.querySelectorAll('.tile:not(.unseen)').length === 0), '도감 미발견 필터');

await nav('#/pipeline');
await until(() => doc.querySelector('.node.done'));
doc.querySelector('.node.done').click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('오늘 이 레슨은 끝') >= 0), '다 익힌 레슨은 다음 복습일 안내');
doc.querySelector('[data-action=sheet-close]').click();

console.log('17. 연속일·레벨 규칙');
const gs = { streak: 5, lastQualified: '2026-12-01', freezesUsed: {}, frozenDays: [] };
G.settle(gs, '2026-12-03');
check(gs.streak === 5 && gs.lastQualified === '2026-12-02' && gs.freezesUsed['2026-12'] === 1, '하루 빠지면 휴가권으로 유지');
const gb = { streak: 5, lastQualified: '2026-12-01', freezesUsed: { '2026-12': 2 }, frozenDays: [] };
G.settle(gb, '2026-12-04');
check(gb.streak === 0 && gb.comebackUntil === '2026-12-06', '휴가권이 없으면 끊기고 재개 보너스 3일');
check(G.levelInfo(0).level === 1 && G.levelInfo(60).level === 2 && G.levelInfo(140).level === 3 && G.levelInfo(140).rank === '1년차 기자', '레벨 곡선·연차');
check(G.levelInfo(9860).rank === '데스크', 'Lv 30 데스크');
await nav('#/me');
check(await until(() => main().indexOf('우주기자') >= 0), '나: 바꾼 이름 표시');

await wait(150);
check(pageErrors.length === 0, '페이지 오류 없음' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));
if (failures.length) { console.log('스모크 검사 실패 ' + failures.length + '건'); process.exit(1); }
console.log('스모크 검사 통과');
process.exit(0);
