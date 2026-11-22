# 이 프로젝트에서 작업할 때

> 앱 이름: **진우주 기자 학교**(D012). 저장소·폴더·저장 키(pharma-health-desk) 이름은 바꾸지 않는다.

> 2026-11-22 첫 판(D001~D017). 문서끼리 다르면 [문서 지도](docs/00-DOCUMENT-MAP.md)의 우선순위를 따른다.

> **핵심 원칙(사용자):** 학습자는 의대생이 아니라 기자다. 정확히 알고, 근거를 따지고, 쉽고 과장 없이 전한다. 진단·치료 판단, 약 용량·처방은 만들지 않는다.

## 0. 사용자가 정한 방향 (매번 지킨다, 2026-11-22)

- **웹게임처럼 몰입하게.** 업무 프로그램·관리자 설정 화면처럼 만들지 않는다. 매일 들어와 내 기자 캐릭터를 보고, 간단한 동작으로 계속 하고 싶게. 디자인은 애플식, 로직은 성공한 웹게임을 모방(`docs/design/UI-PRINCIPLES.md`).
- **버튼은 적게, 기능은 체계적으로.** 화면마다 큰 버튼 하나. 관리 기능은 나 → 설정 한 곳.
- **공부가 곧 게임.** 정적인 목록·카드 나열 대신 게임 안에서 배운다. 지금 쓰는 틀: Little Alchemy 2(인체 연금술), 지뢰찾기(오보 지뢰찾기), Wordle(오늘의 진단·숫자). 2048은 ‘어렵고 이상하다’는 피드백으로 뺐다(D020). 새 게임은 규칙이 바로 이해되는 것만.
- **코스 2(HEALTH BEAT)를 먼저 다 하고 코스 1(PIPELINE).** PIPELINE은 설정에서 열기 전까지 잠김(D019).
- **출석은 하루 한 번, 학습은 무제한.** ‘하루 1개만’ 같은 제한을 두지 않는다. 오늘의 문제(출석·기록·공유) 뒤에는 ‘한 문제 더’ 연습, 새 카드 더, 지뢰찾기 한 판 더처럼 계속할 길을 늘 연다(D020).
- **콘텐츠는 감수를 기다리지 않고 계속 넣고, 전부 만든 뒤 일괄 감수**(D017). 정확성 원칙은 그대로: 과장 없이, 기준일·출처, 진단·처방은 만들지 않는다.
- **단계마다 검사 → 기록 → push → 배포 확인**(3절). 끝나면 바뀐 것과 사람이 확인할 것만 짧게 보고.

## 1. 시작할 때

- 다른 기기에서도 작업할 수 있으므로 먼저 `git fetch` 후 원격 main을 fast-forward로 받는다. 로컬 변경은 보존하고 덮어쓰지 않는다.
- 읽는 순서: 이 파일 → [현재 상태](docs/production/STATUS.md) 맨 위 → [다음 단계](docs/production/NEXT-STEPS.md)의 ‘지금 할 단계’ → 그 단계가 가리키는 기획안 섹션 → 필요하면 [결정 기록](docs/decisions/DECISIONS.md).
- 사용자가 지정한 범위를 우선한다. 지정이 없으면 NEXT-STEPS에서 체크되지 않은 첫 단계 하나만 한다.
- 하지 않은 구현·검수·테스트를 완료라고 기록하지 않는다.

## 2. 지금 어디까지 (2026-11-22)

- 완료: M0 기반(저장소·문서·검사·자동 배포), M1 앱 골격(탭 5개·디자인 토큰·라이트/다크·IndexedDB 저장·팩 가져오기·백업/복원·샘플 팩·설정, 설치 현황은 나 → 개발 현황). 주소 https://jinwuuju.github.io/Pharma-Health-Desk/
- 완료: 단계 2 첫 콘텐츠(W00·W01·통계 시드·마스터 색인, 감수 전 탑재 D017), 단계 2a UI/UX 정돈(D016, `docs/design/UI-PRINCIPLES.md`).
- 완료: 단계 2b 게임형 UI/UX + 단계 3 M2 복습 엔진(D018). 화면은 웹게임 구조(탭 4개 홈·지도·도감·나, 캐릭터·취재 버튼·퀘스트·연속일), 설계는 `docs/design/UI-PRINCIPLES.md`. 새 화면·기능은 이 구조와 규칙을 따른다.
- 완료: 단계 2c 게임 3종 + 코스 2 먼저(D019), 단계 2d 오보 지뢰찾기·무제한 연습(D020). 탭 5개(홈·발견·지뢰찾기·도감·나): 인체 연금술(Little Alchemy 2형), 오보 지뢰찾기(지뢰찾기형, 함정 16종), 오늘의 진단·숫자(Wordle형, 끝나면 ‘한 문제 더’). **코스 2가 먼저이고 PIPELINE은 잠김**(설정 pipelineOpen). 게임 팩은 `tools/build_hb_games.py`로 생성(버전을 올리면 앱이 자동으로 받는다).
- 다음: NEXT-STEPS 단계 4 = M3 레슨 리더(코스 2 항목부터, 게임에서 발견한 원소·질환에서 열기). 콘텐츠는 감수 없이 계속 만들어 넣고, 전부 만든 뒤 일괄 감수(`docs/production/REVIEW-QUEUE.md`).
- 배포: 2026-11-22 오후 사용자 지시로 push를 보류했다가 같은 날 push 지시로 재개했다. 기본은 3절대로 단계마다 push·배포 확인.
- 계획 추가: 온라인 학교(Google 로그인·동료 리그·소통) — [기획안 3](docs/plans/03-ONLINE-SCHOOL.md), 설치 단계 8a·13a·14a(D013·D014). O1은 사용자가 Firebase 준비(기획안 3의 7절)를 마쳐야 시작할 수 있다.
- 학습 일정: W0 진단평가 2026-11-30 주, W1 2026-12-07 시작(두 코스 공통 달력).
- 사람 확인 게이트(작업자가 대신할 수 없음): 화면 미감, 실제 iPhone Safari 동작, 의학·통계 사실 확인, 학습 효과.

## 3. 한 단계를 끝낼 때 (매번)

1. 구현 → `python3 tools/check_project.py` 통과.
2. `site/data/project.json`에서 끝낸 단계를 `done`(+`date`), 다음 단계를 `next`로 바꾸고 `updated`·`current`·`next`를 갱신.
3. [STATUS](docs/production/STATUS.md) 맨 위에 날짜 · 한 일 · 검증한 것 · 검증 못 한 것 · 다음 단계를 추가.
4. [NEXT-STEPS](docs/production/NEXT-STEPS.md)의 체크박스를 체크.
5. 기획안과 다르게 정한 것이 있으면 [DECISIONS](docs/decisions/DECISIONS.md)에 D번호로 기록하고 이 파일 2절을 갱신.
6. 커밋 메시지 형식: `M1: 앱 골격 — 한 줄 요약`. main에 push.
7. Actions 성공과 공개 주소 반영을 확인하고 ‘Record verified M1 deployment’ 커밋으로 STATUS에 남긴다.

## 4. 배포·검증 (D002)

- main에 push하면 `.github/workflows/pages.yml`이 `tools/check_project.py`를 돌린 뒤 `site/`를 그대로 Pages에 올린다.
- 앱 동작 검사(D011): `cd tools/smoke && npm ci && node srs-sim.mjs && node smoke.mjs` — srs-sim은 복습 엔진 30일 시뮬레이션, — jsdom과 가짜 IndexedDB로 화면 이동·가져오기·백업·복원을 확인한다. `site/`를 바꿨으면 push 전에 반드시 돌리고, 새 기능마다 검사 항목을 추가한다.
- 검사 내용: 필수 문서 존재, 모든 JSON 파싱, project.json 구조, `site/`의 HTML 안 스크립트와 `.js` 문법(`node --check`), 공개 저장소 금지 파일(문서·음성·백업·취재원).
- 이 Mac의 경로: node `/opt/homebrew/bin/node`, gh `/opt/homebrew/bin/gh`.
- Actions 실패 시: `gh run list --limit 3` → `gh run view --log-failed`.

## 5. 코드 구조 (D003~D007)

- 빌드 도구 없음. `site/index.html`에서 시작하고, 커지면 `site/js/*.js`(일반 script 태그, ES 모듈 의존 없이)와 `site/css/app.css`로 나눈다. file:// 로 열어도 핵심 기능이 동작해야 한다.
- 현재 파일(D010·D018, 불러오는 순서): `site/js/util.js`(날짜·이스케이프·파일) · `store.js`(IndexedDB·설정·백업, DB_VERSION·SCHEMA_VERSION) · `packs.js`(팩 검사·가져오기) · `srs.js`(복습 엔진, 순수 함수) · `game.js`(XP·레벨·연속일·퀘스트·캐릭터 SVG·효과음) · `play.js`(취재 플레이어) · `alchemy.js`(인체 연금술) · `mines.js`(오보 지뢰찾기) · `daily.js`(오늘의 진단·숫자, 연습) · `screens.js`(홈·도감·나·PIPELINE 지도) · `app.js`(이동·탭·시트·설정·콘텐츠·백업, 마지막에 시작). `site/css/app.css`(토큰·게임 화면). 화면은 store·packs·game을 통해서만 데이터를 바꾼다.
- 외부 CDN·외부 이미지·외부 폰트 금지(오프라인 동작, 저작권). 아이콘은 인라인 SVG로 직접 그린다.
- 저장: 학습 기록·콘텐츠는 IndexedDB, 설정만 localStorage. 저장 스키마에 schemaVersion, 바뀌면 마이그레이션 함수. 백업 JSON 내보내기·가져오기 필수. 기존 사용자 기록을 지우는 변경 금지.
- 한 앱 두 코스(D005): 모든 데이터에 courseId('pipeline' | 'healthbeat').
- 콘텐츠: 원본은 `data/`, 앱 기본 탑재본은 `site/packs/`로 복사(D007). 기본 팩 목록 `site/packs/index.json`의 버전이 바뀌면 앱이 열릴 때 자동으로 받는다(D019).
- 사용자 입력과 콘텐츠 문자열은 반드시 HTML 이스케이프.
- 디자인: 기획안 1의 9장(Apple HIG 스타일 토큰), 코스 2 차이는 기획안 2의 12장, 화면 구조와 규칙은 `docs/design/UI-PRINCIPLES.md`(D018, 웹게임 로직 × 애플식).

## 6. 콘텐츠 작업 규칙

- 생성과 감수는 다른 대화(또는 다른 AI)에서 한다. 감수는 전부 만든 뒤 일괄로 하고, 그 전까지 팩에 `review: draft`(D017).
- 코스 2는 백과 항목이 정본이고 학습 카드는 파생이다(기획안 2의 15장). 통계는 레지스트리에만 두고 본문은 {{ST-xxxx}} 토큰으로 참조한다.
- 수치·제도·시장 정보에는 기준일·출처·재검토일. 확신이 없으면 needsVerification.
- 공개 저장소다(D008): 취재원 정보, 실명 인터뷰 메모, 회사 업무 문서, 앱 백업 파일을 커밋하지 않는다.
