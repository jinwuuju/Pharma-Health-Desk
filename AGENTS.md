# 이 프로젝트에서 작업할 때

> 앱 이름: **진우주 기자 학교**(D012). 저장소·폴더·저장 키(pharma-health-desk) 이름은 바꾸지 않는다.

> 2026-11-22 첫 판(D001~D016). 문서끼리 다르면 [문서 지도](docs/00-DOCUMENT-MAP.md)의 우선순위를 따른다.

> **핵심 원칙(사용자):** 학습자는 의대생이 아니라 기자다. 정확히 알고, 근거를 따지고, 쉽고 과장 없이 전한다. 진단·치료 판단, 약 용량·처방은 만들지 않는다.

## 1. 시작할 때

- 다른 기기에서도 작업할 수 있으므로 먼저 `git fetch` 후 원격 main을 fast-forward로 받는다. 로컬 변경은 보존하고 덮어쓰지 않는다.
- 읽는 순서: 이 파일 → [현재 상태](docs/production/STATUS.md) 맨 위 → [다음 단계](docs/production/NEXT-STEPS.md)의 ‘지금 할 단계’ → 그 단계가 가리키는 기획안 섹션 → 필요하면 [결정 기록](docs/decisions/DECISIONS.md).
- 사용자가 지정한 범위를 우선한다. 지정이 없으면 NEXT-STEPS에서 체크되지 않은 첫 단계 하나만 한다.
- 하지 않은 구현·검수·테스트를 완료라고 기록하지 않는다.

## 2. 지금 어디까지 (2026-11-22)

- 완료: M0 기반(저장소·문서·검사·자동 배포), M1 앱 골격(탭 5개·디자인 토큰·라이트/다크·IndexedDB 저장·팩 가져오기·백업/복원·샘플 팩·설정, 설치 현황은 나 → 개발 현황). 주소 https://jinwuuju.github.io/Pharma-Health-Desk/
- 진행 중: NEXT-STEPS 단계 2 = 첫 콘텐츠 팩. 초안 4종(코스 2 색인·통계, 코스 1 W00·W01)이 `drafts/`에 있음(D015). 남은 것: 새 대화 감수, 사람 확인. 단계 2a UI/UX 정돈은 완료(D016, `docs/design/UI-PRINCIPLES.md`). 감수가 끝나면 단계 2를 닫고 단계 3 = M2 복습 엔진.
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
- 앱 동작 검사(D011): `cd tools/smoke && npm ci && node smoke.mjs` — jsdom과 가짜 IndexedDB로 화면 이동·가져오기·백업·복원을 확인한다. `site/`를 바꿨으면 push 전에 반드시 돌리고, 새 기능마다 검사 항목을 추가한다.
- 검사 내용: 필수 문서 존재, 모든 JSON 파싱, project.json 구조, `site/`의 HTML 안 스크립트와 `.js` 문법(`node --check`), 공개 저장소 금지 파일(문서·음성·백업·취재원).
- 이 Mac의 경로: node `/opt/homebrew/bin/node`, gh `/opt/homebrew/bin/gh`.
- Actions 실패 시: `gh run list --limit 3` → `gh run view --log-failed`.

## 5. 코드 구조 (D003~D007)

- 빌드 도구 없음. `site/index.html`에서 시작하고, 커지면 `site/js/*.js`(일반 script 태그, ES 모듈 의존 없이)와 `site/css/app.css`로 나눈다. file:// 로 열어도 핵심 기능이 동작해야 한다.
- 현재 파일(D010): `site/index.html`(뼈대) · `site/css/app.css`(디자인 토큰·컴포넌트) · `site/js/util.js`(날짜·이스케이프·파일) · `site/js/store.js`(IndexedDB·설정·백업, DB_VERSION·SCHEMA_VERSION) · `site/js/packs.js`(팩 검사·가져오기) · `site/js/app.js`(화면·이벤트). 화면은 store·packs를 통해서만 데이터를 바꾼다.
- 외부 CDN·외부 이미지·외부 폰트 금지(오프라인 동작, 저작권). 아이콘은 인라인 SVG로 직접 그린다.
- 저장: 학습 기록·콘텐츠는 IndexedDB, 설정만 localStorage. 저장 스키마에 schemaVersion, 바뀌면 마이그레이션 함수. 백업 JSON 내보내기·가져오기 필수. 기존 사용자 기록을 지우는 변경 금지.
- 한 앱 두 코스(D005): 모든 데이터에 courseId('pipeline' | 'healthbeat').
- 콘텐츠: 원본은 `data/`, 앱 기본 탑재본은 `site/packs/`로 복사(D007).
- 사용자 입력과 콘텐츠 문자열은 반드시 HTML 이스케이프.
- 디자인: 기획안 1의 9장(Apple HIG 스타일 토큰), 코스 2 차이는 기획안 2의 12장, 화면 규칙 9개는 `docs/design/UI-PRINCIPLES.md`(D016).

## 6. 콘텐츠 작업 규칙

- 생성과 감수는 다른 대화(또는 다른 AI)에서 한다.
- 코스 2는 백과 항목이 정본이고 학습 카드는 파생이다(기획안 2의 15장). 통계는 레지스트리에만 두고 본문은 {{ST-xxxx}} 토큰으로 참조한다.
- 수치·제도·시장 정보에는 기준일·출처·재검토일. 확신이 없으면 needsVerification.
- 공개 저장소다(D008): 취재원 정보, 실명 인터뷰 메모, 회사 업무 문서, 앱 백업 파일을 커밋하지 않는다.
