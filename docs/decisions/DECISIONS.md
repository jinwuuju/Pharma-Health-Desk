# 결정 기록

> 기획안과 다르게 정했거나 기획안에 없던 것을 정할 때 D번호로 남긴다. 번호는 재사용하지 않는다.

## D001 저장소 체계 (2026-11-22)
「건강 기자 키우기」(Raise-a-Healthy-Game)와 같은 문서 체계를 쓴다: AGENTS.md(규칙·현재 위치) · STATUS(사실 기록) · NEXT-STEPS(단계 카드) · DECISIONS · 문서 지도. 어느 기기·어느 AI가 이어받아도 같은 순서로 읽고 한 단계씩 진행하게 하기 위해서다.

## D002 배포 방식 (2026-11-22)
main push → GitHub Actions에서 `tools/check_project.py` 통과 → `site/`를 그대로 GitHub Pages에 올린다. 빌드 단계가 없으므로 저장소의 `site/`가 곧 배포본이다.

## D003 기술 (2026-11-22)
바닐라 HTML·CSS·JavaScript. 패키지 관리자·번들러·외부 CDN 없음. 기획안 1의 10.1(단일 파일, file:// 동작)을 따르되, 코드가 커지면 `site/js/`, `site/css/`로 나누는 것을 허용한다.

## D004 저장 (2026-11-22)
학습 기록·콘텐츠는 IndexedDB, 설정만 localStorage. schemaVersion과 마이그레이션, 백업 JSON 내보내기·가져오기는 M1부터 필수.

## D005 한 앱 두 코스 (2026-11-22)
기획안 2의 0장 권장안을 채택한다. PIPELINE과 HEALTH BEAT를 한 앱에서 운영하고 모든 데이터에 courseId를 둔다.

## D006 설치 순서 (2026-11-22)
기획안 1의 M 순서와 기획안 2의 C·E 순서를 NEXT-STEPS 하나로 엮는다. 코스 2 학습이 W1(2026-12-07)부터 시작하므로 C1·E1·C2를 M4보다 앞에 둔다. iPhone 출퇴근 학습이 코스 2의 기본 운영이므로 PWA 설치를 M10에서 단계 9로 앞당긴다.

## D007 콘텐츠 위치 (2026-11-22)
콘텐츠 원본은 `data/`(packs·canon·registry). 앱에 기본으로 싣는 팩은 `site/packs/`로 복사한다. 앱은 두 경로(기본 탑재, 파일 가져오기) 모두로 팩을 읽는다.

## D008 공개 저장소 원칙 (2026-11-22)
GitHub Pages 무료 배포를 위해 공개 저장소로 둔다. 따라서 취재원 정보, 실명 인터뷰 메모, 회사 업무 문서(.docx·.xlsx·.hwp·.pdf), 음성 파일, 앱 백업 파일은 커밋하지 않는다. `check_project.py`가 금지 형식·이름을 검사한다. 앱의 개인 기록(취재 수첩 등)은 기기 안에만 저장한다.

## D009 기획안 기준본 (2026-11-22)
기획안 1·2의 기준본은 저장소의 `docs/plans/` 사본이다. 바탕화면 원본은 참고용이며, 개정은 저장소 사본에 버전을 올려 한다.

## D010 M1 저장 구조 (2026-11-22)
IndexedDB 이름 pharma-health-desk, 구조 버전 1. 저장소 6개: meta(key), packs(packId), content(id, 색인 packId·kind·courseId), progress(id), attempts(id), daylogs(key). 콘텐츠는 원본 객체를 {id, kind, packId, courseId, data}로 감싸 저장한다. 팩 가져오기는 같은 id를 덮어쓰고 학습 기록(progress·attempts·daylogs)은 건드리지 않는다. 같은 packId의 파트 파일은 합쳐지고, 파트에서 비어 있는 메타 값은 기존 값을 지킨다. 최상위가 배열인 파일(마스터 색인·통계 목록)은 단계 5(C1·E1)부터 받는다. 백업 파일은 app 'pharma-health-desk', kind 'backup', schemaVersion, stores, settings로 이루어지며 더 새 스키마의 백업은 거부한다. 설정은 localStorage 키 phd.settings.

## D011 개발용 앱 동작 검사 (2026-11-22)
D003(빌드 도구 없음)은 배포본(site/)에 대한 원칙이다. 개발용 검사에 한해 tools/smoke에서 npm 의존성(jsdom, fake-indexeddb)을 허용한다. Actions에서 check_project 다음에 돌리고, 통과해야 배포한다. 새 기능을 설치할 때마다 smoke.mjs에 검사 항목을 추가한다.

## D012 앱 이름 (2026-11-22)
앱 이름을 ‘진우주 기자 학교’로 한다(사용자). 화면 제목, 홈 화면 이름, 사이드바, 오늘 화면 머리말, 문서 제목에 쓴다. 저장소 이름(Pharma-Health-Desk)·공개 주소·Mac 폴더 이름·IndexedDB 이름과 백업 식별자(pharma-health-desk)는 주소와 기존 기록·백업 호환을 위해 그대로 둔다.

## D013 온라인 학교 방식 (2026-11-22)
동료 기자와 경쟁·소통하는 온라인 기능은 Firebase(Authentication의 Google 로그인 + Cloud Firestore, 무료 Spark 요금제)로 만든다. 앱은 GitHub Pages에 그대로 두고, SDK는 `site/vendor/`에 고정 버전으로 둔다(D003 유지). 초대제, 공유 최소화(닉네임·주간 점수 요약·연속 학습일·공개한 글만), 오프라인 우선. 기획안 1의 7.2(타인 리그 없음)는 ‘동료 리그는 선택 참여, 강등 없음, 매주 리셋, 지난주의 나 비교 병행’으로 바꾼다. 상세는 기획안 3.

## D014 온라인 단계 위치 (2026-11-22)
O1(로그인·학교)은 XP가 생기는 M5 다음(8a), O3(소통)는 작업실 C4 다음(13a), O2(리그·대결)는 게임 M7·C5 다음(14a)에 둔다. 사용자가 원하면 O1을 앞당길 수 있다. 진행 현황 데이터의 단계마다 표시 번호 n을 둔다.
