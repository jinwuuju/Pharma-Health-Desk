// 개발용 브라우저 흉내 검사(jsdom + fake-indexeddb). 배포본에는 포함되지 않는다(D011).
// 실행: cd tools/smoke && npm ci && node smoke.mjs
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

for (const f of ['util.js', 'store.js', 'packs.js', 'app.js']) {
  w.eval(fs.readFileSync(path.join(site, 'js', f), 'utf8'));
}
const doc = w.document;
const S = w.PHD.store;
const P = w.PHD.packs;
const main = () => doc.getElementById('main').textContent;
const nav = async (hash) => { w.location.hash = hash; await wait(40); };

console.log('1. 첫 화면');
check(await until(() => main().indexOf('오늘') >= 0), '오늘 화면이 열린다');
check(await until(() => main().indexOf('아직 콘텐츠가 없습니다') >= 0), '빈 상태 안내가 보인다');
check(doc.querySelectorAll('.tab').length === 5, '탭 5개');
check(doc.title === '진우주 기자 학교' && doc.getElementById('tabbar').textContent.indexOf('진우주 기자 학교') >= 0, '앱 이름 진우주 기자 학교');

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
check(await until(() => main().indexOf('신약은 어떤 길을 지나 환자에게 가나') >= 0), '파이프라인에 레슨 표시');
await nav('#/review');
check(await until(() => doc.querySelectorAll('details.row-d').length === 7), '복습 카드 미리보기 7장');
await nav('#/exam');
check(await until(() => main().indexOf('주간 미니 시험') >= 0), '시험 목록');
await nav('#/me');
check(await until(() => main().indexOf('SAMPLE-W01') >= 0), '나 탭 팩 목록');
await nav('#/me/dev');
check(await until(() => main().indexOf('설치 단계') >= 0 && main().indexOf('앱 골격') >= 0), '개발 현황');
check(main().indexOf('8a. O1') >= 0 && main().indexOf('14a. O2') >= 0, '개발 현황에 온라인 단계 번호');
await nav('#/nothing');
check(await until(() => main().indexOf('학습 일정') >= 0), '모르는 주소는 오늘로');

console.log('7. 설정');
await nav('#/me');
await until(() => doc.querySelector('[data-key=theme][data-val=dark]'));
doc.querySelector('[data-key=theme][data-val=dark]').click();
check(await until(() => doc.documentElement.getAttribute('data-theme') === 'dark'), '다크 테마 적용');
check(JSON.parse(w.localStorage.getItem('phd.settings')).theme === 'dark', '설정 저장');
await until(() => doc.querySelector('[data-key=fontScale][data-val="1.15"]') || doc.querySelector('[data-key=fontScale]'));
const big = Array.prototype.slice.call(doc.querySelectorAll('[data-key=fontScale]')).filter((b) => b.getAttribute('data-val') === '1.15')[0];
big.click();
check(await until(() => doc.documentElement.style.fontSize === '18.4px'), '글자 크기 적용');
const newInput = doc.getElementById('set-new');
newInput.value = '999';
newInput.dispatchEvent(new w.Event('change', { bubbles: true }));
check(await until(() => S.loadSettings().dailyNew === 50), '숫자 설정 범위 제한');

console.log('8. 백업·초기화·복원');
const backup = await S.exportAll(S.loadSettings());
const n0 = await S.count('content');
check(n0 > 0 && backup.stores.content.length === n0, '백업에 모든 콘텐츠 포함');
check(S.validateBackup(backup).errors.length === 0, '백업 검사 통과');
await S.resetAll();
check((await S.count('content')) === 0 && S.loadSettings().theme === 'auto', '초기화');
const res = await S.restoreAll(JSON.parse(JSON.stringify(backup)));
const prog2 = await S.get('progress', 'SAMPLE-C1');
check(res.skipped === 0 && (await S.count('content')) === n0 && prog2 && prog2.phase === 'p1', '복원 후 콘텐츠·학습 기록 일치');
check(S.loadSettings().theme === 'dark', '복원 후 설정 일치');
check(S.validateBackup({ app: 'x' }).errors.length > 0, '다른 파일 복원 거부');
check(S.validateBackup(Object.assign({}, backup, { schemaVersion: 99 })).errors.length > 0, '새 버전 백업 거부');

console.log('9. 붙여넣기(코드 울타리)');
await nav('#/me');
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
await nav('#/me');
check(await until(() => doc.querySelector('[data-action=delete-pack][data-id=PASTE-1]')), '삭제 버튼 표시');
doc.querySelector('[data-action=delete-pack][data-id=PASTE-1]').click();
check(await until(async () => !(await S.get('packs', 'PASTE-1'))), '팩 삭제');
check((await S.get('progress', 'SAMPLE-C1')).phase === 'p1', '다른 학습 기록 유지');

console.log('11. 초안·원본 팩 가져오기');
const root = path.resolve(here, '..', '..');
const packFiles = [];
const walkJson = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { walkJson(p); } else if (f.name.endsWith('.json')) { packFiles.push(p); } } };
for (const dir of ['data']) { if (fs.existsSync(path.join(root, dir))) { walkJson(path.join(root, dir)); } }
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
console.log('12. 오늘 화면 정돈·키보드 이동(D016)');
await nav('#/today');
check(await until(() => doc.querySelector('[data-action=tab][data-tab=pipeline].btn')), '콘텐츠가 있으면 오늘 화면에 주 행동 버튼(레슨 보기)');
check(main().indexOf('학습 일정') >= 0 && !!doc.querySelector('.row .val.accent'), '학습 일정 목록과 가장 가까운 일정 강조');
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: '2', bubbles: true }));
check(await until(() => w.location.hash.indexOf('pipeline') >= 0), '숫자 키 2로 파이프라인 탭 이동');
doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: '1', bubbles: true }));
check(await until(() => w.location.hash.indexOf('today') >= 0), '숫자 키 1로 오늘 탭 이동');
check(doc.querySelectorAll('.tab kbd').length === 5, '탭마다 단축키 표시');
console.log('13. 기본 콘텐츠 불러오기·감수 전 표시(D017)');
for (const id of ['W00-diagnostic', 'W01-pipeline-map', 'HB-REG-001']) { await P.deletePack(id); }
await nav('#/me');
check(await until(() => doc.querySelector('[data-action=load-builtin]')), '기본 콘텐츠 불러오기 버튼');
doc.querySelector('[data-action=load-builtin]').click();
check(await until(async () => !!(await S.get('packs', 'W00-diagnostic')) && !!(await S.get('packs', 'W01-pipeline-map')) && !!(await S.get('packs', 'HB-REG-001')), 5000), '기본 팩 3개(W00·W01·통계 시드) 불러오기');
check((await S.get('packs', 'W01-pipeline-map')).review === 'draft', '감수 상태 저장');
const shc = doc.querySelector('[data-action=sheet-close]'); if (shc) { shc.click(); }
await nav('#/today'); await nav('#/me');
check(await until(() => main().indexOf('감수 전') >= 0), '나 화면에 감수 전 표시');
await wait(100);
check(pageErrors.length === 0, '페이지 오류 없음' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));
if (failures.length) { console.log('스모크 검사 실패 ' + failures.length + '건'); process.exit(1); }
console.log('스모크 검사 통과');
process.exit(0);
