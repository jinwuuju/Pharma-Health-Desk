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

const order = [...html.matchAll(/src='js[/]([a-z0-9]+[.]js)'/g)].map((m) => m[1]);
w.localStorage.setItem('phd.settings', JSON.stringify({ autoUpdate: false }));
let copied = '';
Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { copied = t; } } });
for (const f of order) { w.eval(fs.readFileSync(path.join(site, 'js', f), 'utf8')); }

const doc = w.document;
const S = w.PHD.store;
const P = w.PHD.packs;
const G = w.PHD.game;
const PL = w.PHD.play;
const main = () => doc.getElementById('main').textContent;
const playBox = () => doc.getElementById('play');
const nav = async (hash) => { w.location.hash = hash; await wait(40); };
const key = (k) => doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const setInput = (id, v) => { const i = doc.getElementById(id); i.value = v; i.dispatchEvent(new w.Event('change', { bubbles: true })); };
const today = () => w.PHD.util.studyDate(4);

console.log('0. 스크립트 순서');
check(order.join(',') === 'util.js,store.js,packs.js,srs.js,game.js,play.js,alchemy.js,mines.js,daily.js,screens.js,app.js', 'index.html 스크립트 11개 ' + order.join(','));

console.log('1. 첫 화면(게임 홈)');
check(await until(() => doc.querySelector('.stage .char')), '홈에 캐릭터');
check(await until(() => main().indexOf('취재 카드가 아직 없어요') >= 0), '빈 상태 말풍선');
check(!!doc.querySelector('.play-btn[data-action=load-builtin]'), '빈 상태 주 행동 = 기본 콘텐츠 받기');
check(doc.querySelectorAll('.tab').length === 5 && doc.getElementById('tabbar').textContent.indexOf('발견') >= 0 && doc.getElementById('tabbar').textContent.indexOf('지뢰찾기') >= 0, '탭 5개(홈·발견·지뢰찾기·도감·나)');
check(doc.title === '진우주 기자 학교', '앱 이름');
check(main().indexOf('HEALTH BEAT') >= 0 && main().indexOf('수습기자') >= 0, '코스 2 표시·수습기자');

console.log('2. 샘플(코스 1) 가져오기');
doc.querySelector('[data-action=load-sample]').click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('새로 ') >= 0), '가져오기 결과 시트');
const sum1 = await P.summary();
check(sum1.packs === 1 && sum1.kinds.card === 6, '샘플 팩 저장');
doc.querySelector('[data-action=sheet-close]').click();

console.log('3. 재가져오기·파트·잘못된 입력');
await S.putMany('progress', [{ id: 'SAMPLE-C1', courseId: 'pipeline', phase: 'p1' }]);
const sampleText = fs.readFileSync(path.join(site, 'packs', 'sample.json'), 'utf8');
const r2 = await P.importPack(JSON.parse(sampleText), 'again');
check(r2.ok && r2.added === 0 && (await S.get('progress', 'SAMPLE-C1')).phase === 'p1', '중복 없이 갱신·학습 기록 보존');
await S.del('progress', 'SAMPLE-C1');
const r3 = await P.importPack({ packId: 'SAMPLE-W01', cards: [{ id: 'SAMPLE-C7', front: '추가 카드', back: '파트 2' }] }, 'part2');
check(r3.ok && (await S.get('packs', 'SAMPLE-W01')).counts.card === 7, '파트 병합');
check(!(await P.importPack([], 'arr')).ok && !(await P.importPack({ title: 'x', cards: [] }, 'n')).ok && !(await P.importPack({ packId: 'X', courseId: 'other', cards: [] }, 'c')).ok, '잘못된 팩 거부');

console.log('4. 코스 1 잠금(D019)');
check((await PL.loadDeck()).cards.length === 0, 'PIPELINE 카드는 잠김 상태에서 덱에 없음');
await nav('#/review');
check(await until(() => main().indexOf('도감이 비어 있어요') >= 0), '도감에도 코스 1 카드 없음');
await nav('#/pipeline');
check(await until(() => main().indexOf('HEALTH BEAT를 마친 뒤 열려요') >= 0 && doc.querySelector('.node.locked')), 'PIPELINE 지도: 잠김 안내·잠긴 칸');
await nav('#/exam');
check(await until(() => !!doc.querySelector('.lock-card')), '옛 시험 주소는 PIPELINE 지도로');

console.log('5. 게임 빈 상태');
await nav('#/discover');
check(await until(() => main().indexOf('연금술 재료가 아직 없어요') >= 0), '발견: 재료 없음 안내');
await nav('#/evidence');
check(await until(() => main().indexOf('함정 자료가 아직 없어요') >= 0), '지뢰찾기: 빈 상태');
await nav('#/puzzle/dx');
check(await until(() => main().indexOf('퍼즐 재료가 없어요') >= 0), '오늘의 진단: 빈 상태');

console.log('6. 설정');
await nav('#/me/settings');
await until(() => doc.querySelector('[data-key=theme][data-val=dark]'));
doc.querySelector('[data-key=theme][data-val=dark]').click();
check(await until(() => doc.documentElement.getAttribute('data-theme') === 'dark'), '다크 테마');
await until(() => doc.getElementById('set-new'));
setInput('set-new', '999');
check(await until(() => S.loadSettings().dailyNew === 50), '숫자 설정 범위 제한');
setInput('set-new', '8');
setInput('set-nick', '우주기자');
check(await until(() => S.loadSettings().nickname === '우주기자'), '캐릭터 이름 저장');
await until(() => doc.querySelector('[data-key=sound][data-val=false]'));
doc.querySelector('[data-key=sound][data-val=false]').click();
check(await until(() => S.loadSettings().sound === false), '효과음 끄기');
check(!!doc.querySelector('[data-key=pipelineOpen][data-val=true]') && S.loadSettings().pipelineOpen === false, '코스 1 잠금 기본값·열기 버튼');

console.log('7. 백업·초기화·복원');
const backup = await S.exportAll(S.loadSettings());
const n0 = await S.count('content');
check(n0 > 0 && S.validateBackup(backup).errors.length === 0, '백업 검사 통과');
await S.resetAll();
check((await S.count('content')) === 0, '초기화');
const res = await S.restoreAll(JSON.parse(JSON.stringify(backup)));
check(res.skipped === 0 && (await S.count('content')) === n0 && S.loadSettings().nickname === '우주기자', '복원 후 일치');
check(S.validateBackup({ app: 'x' }).errors.length > 0 && S.validateBackup(Object.assign({}, backup, { schemaVersion: 99 })).errors.length > 0, '잘못된 백업 거부');

console.log('8. 붙여넣기·삭제');
await nav('#/me/settings');
await until(() => doc.querySelector('[data-action=import-paste]'));
doc.querySelector('[data-action=import-paste]').click();
await until(() => doc.getElementById('paste-box'));
doc.getElementById('paste-box').value = '```json' + NL + JSON.stringify({ packId: 'PASTE-1', courseId: 'healthbeat', cards: [{ id: 'P-C1', front: 'a', back: 'b' }] }) + NL + '```';
doc.querySelector('[data-action=paste-import]').click();
check(await until(async () => !!(await S.get('packs', 'PASTE-1'))), '울타리 붙은 JSON 가져오기');
doc.querySelector('[data-action=sheet-close]').click();
await nav('#/today'); await nav('#/me/settings');
await until(() => doc.querySelector('[data-action=delete-pack][data-id=PASTE-1]'));
doc.querySelector('[data-action=delete-pack][data-id=PASTE-1]').click();
check(await until(async () => !(await S.get('packs', 'PASTE-1'))), '팩 삭제');

console.log('9. 기본 콘텐츠(코스 2 게임 팩 포함)');
doc.querySelector('[data-action=load-builtin]').click();
check(await until(async () => !!(await S.get('packs', 'HB-GAME-001')) && !!(await S.get('packs', 'W01-pipeline-map')) && !!(await S.get('packs', 'HB-REG-001')), 6000), '기본 팩 4개(HB 게임·통계·W00·W01)');
const hb = await S.get('packs', 'HB-GAME-001');
check(hb.courseId === 'healthbeat' && hb.counts.element === 64 && hb.counts.recipe === 58 && hb.counts.evidence === 10 && hb.counts.trap === 16 && hb.counts.disease === 119 && hb.counts.card === 236, 'HB 게임 팩: 원소 64·조합 58·근거 10·함정 16·질환 119·카드 236');
const man = JSON.parse(fs.readFileSync(path.join(site, 'packs', 'index.json'), 'utf8'));
check(man.packs[0].packId === 'HB-GAME-001', '기본 팩 목록 첫 줄이 코스 2');
let shc = doc.querySelector('[data-action=sheet-close]'); if (shc) { shc.click(); }
check((await PL.loadDeck()).cards.length === 0, '아무것도 발견하기 전엔 취재 덱이 비어 있음');

console.log('10. 홈: 다음 할 일 버튼 하나');
await nav('#/today');
check(await until(() => doc.querySelector(`.play-btn[data-to='puzzle/dx']`)), '첫 할 일 = 오늘의 진단');
check(doc.querySelectorAll('.main .play-btn').length === 1 && doc.querySelectorAll('.ptile').length === 2, '큰 버튼 하나 + 퍼즐 타일 2개');
check(doc.querySelectorAll('.quest').length === 3 && main().indexOf('새 발견') >= 0 && main().indexOf('오늘의 퍼즐') >= 0, '퀘스트: 복습·새 발견·오늘의 퍼즐');
check(main().indexOf('HEALTH BEAT W1') >= 0, '다음 일정 = HEALTH BEAT W1');
key('2');
check(await until(() => w.location.hash.indexOf('discover') >= 0), '숫자 키 2 → 발견');
key('3');
check(await until(() => w.location.hash.indexOf('evidence') >= 0), '숫자 키 3 → 지뢰찾기');
key('1');
check(await until(() => w.location.hash.indexOf('today') >= 0 && doc.querySelectorAll('.tab kbd').length === 5), '숫자 키 1 → 홈');

console.log('11. 인체 연금술(Little Alchemy형)');
const xp0 = (await G.load(today())).game.xp;
await nav('#/discover');
check(await until(() => doc.querySelectorAll('.el').length === 6), '기본 원소 6개');
const pick = (id) => doc.querySelector('[data-action=al-pick][data-id=' + id + ']').click();
pick('HB-AL-cell'); pick('HB-AL-cell');
check(await until(() => doc.getElementById('sheet').textContent.indexOf('새 발견') >= 0 && doc.getElementById('sheet').textContent.indexOf('조직') >= 0), '세포 + 세포 = 조직 발견');
check(!!(await G.loadDiscover()).al['HB-AL-tissue'], '발견 기록 저장');
check((await PL.loadDeck()).cards.some((c) => c.id === 'HB-C-AL-tissue'), '발견한 카드가 취재 덱에 들어감');
check((await G.load(today())).game.xp === xp0 + 2 && (await G.load(today())).log.disc === 1, '+2 XP · 새 발견 1');
doc.querySelector('[data-action=al-continue]').click();
check(await until(() => doc.querySelectorAll('.el').length === 7 && doc.querySelector('.el.fresh')), '조직이 원소판에 반짝이며 추가');
pick('HB-AL-air'); pick('HB-AL-time');
check(await until(() => main().indexOf('아무 일도') >= 0 || main().indexOf('섞이지 않') >= 0 || main().indexOf('반응 없음') >= 0 || main().indexOf('서로 모르는') >= 0), '없는 조합은 반응 없음');
await wait(750);
pick('HB-AL-cell'); pick('HB-AL-cell');
check(await until(() => main().indexOf('이미 발견한') >= 0), '아는 조합은 이미 발견 안내');
await wait(800);
doc.querySelector('[data-action=al-hint]').click();
check(await until(() => main().indexOf('💡') >= 0 && doc.querySelector('.el.hint')), '힌트: 재료 하나 강조');
pick('HB-AL-tissue'); pick('HB-AL-tissue');
await until(() => doc.querySelector('[data-action=al-continue]'));
doc.querySelector('[data-action=al-continue]').click();
await wait(100);
pick('HB-AL-food'); pick('HB-AL-blood');
check(await until(() => doc.getElementById('sheet').textContent.indexOf('혈당') >= 0), '음식 + 혈액 = 혈당');
check((await G.load(today())).log.disc === 3, '오늘 새 발견 3');
doc.querySelector('[data-action=al-continue]').click();
const alStats = await w.PHD.alchemy.stats();
check(alStats.found === 9 && alStats.total === 64, '연금술 9/64');

console.log('12. 오보 지뢰찾기(D020)');
const board = (mines, traps) => { const n = 64, o = { key: 'mines', level: 'easy', mine: [], open: [], flag: [], trap: [], hit: {}, hearts: 3, started: true, over: false, won: false, t0: Date.now(), t1: 0, best: {}, wins: 0 }; for (let i = 0; i < n; i++) { o.mine.push(mines.includes(i)); o.open.push(false); o.flag.push(false); o.trap.push(mines.includes(i) ? traps[mines.indexOf(i)] : null); } return o; };
await nav('#/evidence');
check(await until(() => doc.querySelectorAll('#ms-board .mc').length === 64 && doc.querySelector('#ms-face')), '8×8 판·얼굴 버튼(수습)');
check(doc.querySelectorAll('.ms-level button').length === 3 && doc.querySelectorAll('.ms-mode button').length === 2, '난이도 3단계·열기/깃발 전환');
doc.querySelector('#ms-board .mc[data-i="27"]'.split(String.fromCharCode(34)).join("'")).click();
check(await until(() => doc.querySelectorAll('#ms-board .mc.op').length >= 9), '첫 칸은 늘 안전, 주변이 열림');
await S.putMany('meta', [board([0], ['HB-TR-mouse'])]);
await nav('#/today'); await nav('#/evidence');
await until(() => doc.querySelectorAll('#ms-board .mc').length === 64);
const xpm = (await G.load(today())).game.xp;
doc.querySelector("#ms-board .mc[data-i='0']").click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('오보 함정을 밟았어요') >= 0 && doc.querySelectorAll('.tc').length === 3), '함정 밟음 → 3지선다');
check(doc.getElementById('sheet').textContent.indexOf('생쥐 실험') >= 0, '함정 = 쥐 실험을 치료 효과로');
doc.querySelector(".tc[data-k='0']").click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('함정 해체') >= 0), '정답 → 함정 해체');
const dm = await G.loadDiscover();
check(!!dm.tr['HB-TR-mouse'] && !!dm.ev['HB-EV-02'], '함정·근거 사다리 2단계 카드 열림');
check((await G.load(today())).game.xp === xpm + 2, '해체 +2 XP');
doc.querySelector('[data-action=ms-continue]').click();
await wait(100);
doc.querySelector("#ms-board .mc[data-i='63']").click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('기사 승인') >= 0), '안전한 칸을 다 열면 기사 승인');
check(doc.querySelectorAll('.ms-stars i.on').length === 2, '밟았지만 모두 해체 → 별 2개');
doc.querySelector('[data-action=ms-new]').click();
await S.putMany('meta', [board([0, 1, 2], ['HB-TR-causal', 'HB-TR-relative', 'HB-TR-case'])]);
await nav('#/today'); await nav('#/evidence');
await until(() => doc.querySelectorAll('#ms-board .mc').length === 64);
doc.querySelector("#ms-board .mc[data-i='0']").click();
await until(() => doc.querySelectorAll('.tc').length === 3);
doc.querySelector(".tc[data-k='1']").click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('오보가 나갔어요') >= 0 && w.PHD.mines.state().hearts === 2), '오답 → ❤️ 하나 잃음·해설');
doc.querySelector('[data-action=ms-continue]').click();
await wait(100);
doc.querySelector("[data-action=ms-mode][data-val='flag']").click();
await until(() => doc.querySelector("[data-action=ms-mode][data-val='flag'][aria-pressed='true']"));
doc.querySelector("#ms-board .mc[data-i='1']").click();
check(await until(() => w.PHD.mines.state().flag[1] && doc.querySelector("#ms-board .mc[data-i='1']").textContent.indexOf('🚩') >= 0), '깃발 모드로 깃발 꽂기');
doc.querySelector("[data-action=ms-mode][data-val='open']").click();
await until(() => doc.querySelector("[data-action=ms-mode][data-val='open'][aria-pressed='true']"));
doc.querySelector("[data-action=ms-level][data-val='mid']").click();
check(await until(() => doc.querySelectorAll('#ms-board .mc').length === 88), '기자 난이도 8×11');

console.log('13. 오늘의 진단(Wordle형)');
await nav('#/today');
check(await until(() => doc.querySelector('.play-btn[data-action=play]') && doc.querySelector(`.ptile[data-to='puzzle/dx']`)), '발견 카드가 생기면 주 행동은 취재, 퍼즐은 타일로');
doc.querySelector(`.ptile[data-to='puzzle/dx']`).click();
check(await until(() => doc.getElementById('dx-in') && doc.querySelectorAll('.dx-row.empty').length === 6), '6줄 빈 판·입력칸');
const names = [...doc.querySelectorAll('#dx-list option')].map((o) => o.getAttribute('value'));
check(names.length >= 100, '질환 후보 목록 ' + names.length);
doc.getElementById('dx-in').value = '없는병';
doc.querySelector('[data-action=dx-guess]').click();
check(await until(() => main().indexOf('목록에 있는 질환 이름') >= 0), '목록에 없는 이름 거부');
for (let i = 0; i < 6; i++) {
  if (!doc.getElementById('dx-in')) { break; }
  doc.getElementById('dx-in').value = names[i * 7];
  doc.getElementById('dx-in').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await until(() => doc.querySelectorAll('.dx-row:not(.empty):not(.hd)').length === i + 1 || !doc.getElementById('dx-in'), 2000);
}
check(await until(() => main().indexOf('카드가 취재 덱에 들어갔어요') >= 0, 3000), '끝: 정답 공개·카드 열림');
check(doc.querySelectorAll('.dx-row:not(.empty):not(.hd) .dx-c').length % 6 === 0 && !!doc.querySelector('.dx-c.g, .dx-c.y, .dx-c.n'), '칸마다 초록·노랑·회색 단서');
const dl = await S.get('meta', 'daily');
check(dl.dx.done && dl.stats.dx.played === 1 && Object.keys((await G.loadDiscover()).dx).length === 1, '기록·발견 저장');
doc.querySelector('[data-action=pz-share]').click();
check(await until(() => copied.indexOf('진우주 기자 학교 · 오늘의 진단 #') === 0 && copied.indexOf('🟩') + copied.indexOf('⬜') + copied.indexOf('🟨') > -3), '결과 복사(공유 그리드)');

const played1 = (await S.get('meta', 'daily')).stats.dx.played;
check(!!doc.querySelector("[data-action=pz-more][data-kind='dx']"), '끝나면 ‘한 문제 더’');
doc.querySelector("[data-action=pz-more][data-kind='dx']").click();
check(await until(() => w.location.hash === '#/puzzle/dxp' && doc.getElementById('dx-in') && main().indexOf('연습') >= 0), '연습 문제가 바로 열림');
for (let i = 0; i < 6; i++) {
  if (!doc.getElementById('dx-in')) { break; }
  doc.getElementById('dx-in').value = names[i * 11 + 3];
  doc.querySelector('[data-action=dx-guess]').click();
  await until(() => doc.querySelectorAll('.dx-row:not(.empty):not(.hd)').length === i + 1 || !doc.getElementById('dx-in'), 2000);
}
check(await until(() => main().indexOf('카드가 취재 덱에 들어갔어요') >= 0, 3000), '연습 문제 끝');
const dl2 = await S.get('meta', 'daily');
check(dl2.stats.dx.played === played1 && dl2.practiceDone === 1, '연습은 오늘의 기록(출석·통계)과 따로');
doc.querySelector("[data-action=pz-more][data-kind='dx']").click();
check(await until(async () => (await S.get('meta', 'daily')).practice.dx.n === 2 && doc.getElementById('dx-in')), '연습은 몇 번이든 계속');

console.log('14. 오늘의 숫자');
await nav('#/puzzle/num');
check(await until(() => doc.getElementById('num-in') && main().indexOf('단위') >= 0), '숫자 퍼즐: 문제·단위');
for (let i = 0; i < 6; i++) {
  if (!doc.getElementById('num-in')) { break; }
  doc.getElementById('num-in').value = String(10 ** i);
  doc.querySelector('[data-action=num-guess]').click();
  await until(() => doc.querySelectorAll('.nm-row:not(.empty)').length === i + 1 || !doc.getElementById('num-in'), 2000);
}
check(await until(() => main().indexOf('공표') >= 0 && main().indexOf('카드가 취재 덱에 들어갔어요') >= 0, 3000), '끝: 숫자·정의·공표일 공개');
check((await G.load(today())).log.puzzles === 2, '오늘의 퍼즐 2개 완료(연습은 세지 않음)');

console.log('15. 취재 — 발견한 카드 복습(M2)');
await nav('#/today');
check(await until(() => doc.querySelector('.play-btn[data-action=play]')), '발견한 카드가 생기면 홈 주 행동 = 취재');
const deck1 = await PL.loadDeck();
const dsc = await G.loadDiscover();
const nDisc = ['al', 'ev', 'tr', 'dx', 'num'].reduce((a, k) => a + Object.keys(dsc[k]).length, 0);
check(deck1.cards.length === nDisc && deck1.cards.every((c) => c.courseId === 'healthbeat'), '취재 덱 = 게임에서 발견한 코스 2 카드 ' + nDisc + '장');
key('Enter');
check(await until(() => !playBox().hidden && doc.querySelector('.pl-q')), '취재 시작');
let steps = 0;
while (steps++ < 40 && !doc.querySelector('.rs-title')) {
  await until(() => doc.querySelector('.cbtn') || doc.querySelector('.gbtn') || doc.querySelector('.rs-title'), 2000);
  if (doc.querySelector('.cbtn')) { key('e'); await until(() => doc.querySelector('.gbtn'), 1000); }
  if (doc.querySelector('.gbtn')) { key('4'); await wait(300); }
}
check(await until(() => doc.querySelector('.rs-title')), '결과 화면');
const log2 = (await G.load(today())).log;
check(log2.fresh === Math.min(8, nDisc) && log2.qualified, '새 카드 ' + Math.min(8, nDisc) + '장(하루 한도 8) · 연속일 인정');
check((await G.load(today())).game.streak === 1, '연속 1일');
key('Enter');
check(await until(() => playBox().hidden), '결과 닫기');
await nav('#/review');
check(await until(() => doc.querySelectorAll('.tile').length === 236 && doc.querySelectorAll('.tile:not(.unseen)').length === nDisc), '도감 ' + nDisc + '/236 열림');
doc.querySelector('.tile.unseen').click();
check(await until(() => doc.getElementById('sheet').textContent.indexOf('발견하면 열립니다') >= 0), '미발견 카드: 어디서 열리는지 안내');
doc.querySelector('#sheet [data-action=go]').click();
check(await until(() => w.location.hash.indexOf('#/') === 0 && doc.getElementById('sheet').hidden), '안내 버튼으로 해당 게임 이동');

console.log('16. 코스 1 열기');
await nav('#/me/settings');
await until(() => doc.querySelector('[data-key=pipelineOpen][data-val=true]'));
doc.querySelector('[data-key=pipelineOpen][data-val=true]').click();
check(await until(async () => (await PL.loadDeck()).cards.some((c) => c.courseId === 'pipeline')), '열면 코스 1 카드가 덱에 들어감');
const d2 = await PL.loadDeck();
check(d2.cards[0].courseId === 'healthbeat', '덱 순서는 여전히 코스 2 먼저');
await nav('#/pipeline');
check(await until(() => doc.querySelector('.node.current') && !doc.querySelector('.lock-card')), 'PIPELINE 지도 열림');
doc.querySelector('[data-key]') ;
await nav('#/me/settings');
await until(() => doc.querySelector('[data-key=pipelineOpen][data-val=false]'));
doc.querySelector('[data-key=pipelineOpen][data-val=false]').click();
check(await until(() => S.loadSettings().pipelineOpen === false), '다시 잠금');

console.log('17. 기본 콘텐츠 자동 받기(D019)');
await S.resetAll();
w.localStorage.setItem('phd.settings', JSON.stringify({ autoUpdate: true }));
w.PHD.app.state.settings = S.loadSettings();
const got = await w.PHD.app.autoUpdate();
check(got === 4 && !!(await S.get('packs', 'HB-GAME-001')), '빈 기기에서 기본 팩 4개 자동 받기');
check((await w.PHD.app.autoUpdate()) === 0, '이미 최신이면 받지 않음');
await nav('#/me/settings');
await until(() => doc.querySelector('[data-action=delete-pack][data-id=W00-diagnostic]'));
doc.querySelector('[data-action=delete-pack][data-id=W00-diagnostic]').click();
await until(async () => !(await S.get('packs', 'W00-diagnostic')));
check((await w.PHD.app.autoUpdate()) === 0 && !(await S.get('packs', 'W00-diagnostic')), '사용자가 지운 팩은 다시 받지 않음');

console.log('18. 연속일·레벨 규칙');
const gs = { streak: 5, lastQualified: '2026-12-01', freezesUsed: {}, frozenDays: [] };
G.settle(gs, '2026-12-03');
check(gs.streak === 5 && gs.freezesUsed['2026-12'] === 1, '하루 빠지면 휴가권으로 유지');
const gb = { streak: 5, lastQualified: '2026-12-01', freezesUsed: { '2026-12': 2 }, frozenDays: [] };
G.settle(gb, '2026-12-04');
check(gb.streak === 0 && gb.comebackUntil === '2026-12-06', '휴가권이 없으면 끊기고 재개 보너스');
check(G.levelInfo(140).rank === '1년차 기자' && G.levelInfo(9860).rank === '데스크', '레벨·연차');
check(w.PHD.daily.cho('당뇨병') === 'ㄷㄴㅂ', '초성 힌트');
await nav('#/me');
check(await until(() => main().indexOf('HEALTH BEAT') >= 0 && main().indexOf('잠김') >= 0), '나: 코스 상태');

await wait(150);
check(pageErrors.length === 0, '페이지 오류 없음' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));
if (failures.length) { console.log('스모크 검사 실패 ' + failures.length + '건'); process.exit(1); }
console.log('스모크 검사 통과');
process.exit(0);
