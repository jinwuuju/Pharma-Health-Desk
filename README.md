# 제약·헬스 기자 데스크 (PIPELINE × HEALTH BEAT)

건강의학 기자가 제약·바이오 산업 전문기자로 성장하기 위한 개인 학습 앱과 ‘기자 바이블’(건강의학 백과)을 만드는 저장소. 기획·개발: **진우주**.

> **핵심 원칙:** 학습자는 의대생이 아니라 기자다. 이 앱이 키우는 능력은 정확히 알고, 근거를 따지고, 쉽고 과장 없이 전하는 것이다. 진단·치료 판단과 약 용량·처방은 다루지 않는다.

> **앱 열기:** https://jinwuuju.github.io/Pharma-Health-Desk/
>
> **현재 배포: M0 시작 화면 / 2026-11-22.** 저장소 뼈대, 기획 문서, 자동 배포, 설치 단계 현황 화면. 학습 기능은 M1부터 한 단계씩 설치한다. [현재 상태](docs/production/STATUS.md) · [다음 단계](docs/production/NEXT-STEPS.md)

## 두 코스

| 코스 | 이름 | 목표 | 기획 |
|---|---|---|---|
| 1 | PIPELINE | 제약산업 특성화대학원 입학 전, 약학·생명과학·경영 전공 동기 수준까지 (36주) | [기획안 1](docs/plans/01-PIPELINE.md) |
| 2 | HEALTH BEAT | 인체·질환 기본기 건강기자 5~7년차, 제약·바이오 기사 작성 1~3년차 + 평생 쓰는 건강의학 백과 | [기획안 2](docs/plans/02-HEALTH-BEAT.md) |

## 이어서 작업하는 법 (한 단계씩)

1. 이 폴더(`~/제약헬스 기자 데스크`)에서 코딩 에이전트를 열고 이렇게 말한다: **“AGENTS.md를 읽고 NEXT-STEPS.md의 다음 단계를 진행해줘.”**
2. 에이전트는 단계 하나만 구현하고, `python3 tools/check_project.py`를 통과시킨 뒤, 진행 현황·STATUS를 갱신하고 main에 push한다.
3. push하면 GitHub Actions가 검사 후 Pages에 자동 배포한다. 1~2분 뒤 앱 주소에서 확인한다.

채팅형 AI로 진행할 때는 [다음 단계](docs/production/NEXT-STEPS.md)의 ‘채팅 AI로 할 때’를 따른다.

## 먼저 읽을 문서

어느 문서가 기준인지는 [문서 지도](docs/00-DOCUMENT-MAP.md)에서 먼저 확인한다.

1. [작업 규칙](AGENTS.md)
2. [전체 로드맵](docs/00-MASTER-ROADMAP.md)
3. [현재 상태](docs/production/STATUS.md)
4. [다음 단계](docs/production/NEXT-STEPS.md)
5. [기획안 1 — PIPELINE](docs/plans/01-PIPELINE.md)
6. [기획안 2 — HEALTH BEAT 바이블](docs/plans/02-HEALTH-BEAT.md)
7. [결정 기록](docs/decisions/DECISIONS.md)

## 폴더

| 경로 | 내용 |
|---|---|
| `site/` | 배포되는 앱. 빌드 도구 없이 그대로 Pages에 올라간다 |
| `site/data/project.json` | 설치 단계 현황(시작 화면이 읽음, 단계가 끝날 때마다 갱신) |
| `site/packs/` | 앱에 기본으로 싣는 콘텐츠 팩(원본은 `data/`) |
| `data/packs/pipeline/`, `data/packs/healthbeat/` | 학습 콘텐츠 팩 원본(JSON) |
| `data/canon/` | 코스 2 백과 항목(CanonPack)과 마스터 색인 |
| `data/registry/` | 통계 레지스트리(StatRecord) |
| `docs/` | 기획·로드맵·상태·결정 기록 |
| `tools/` | 검사 스크립트 |

## 주의

- 공개 저장소다. 취재원 연락처, 인터뷰 메모, 회사 업무 문서, 앱 백업 파일은 올리지 않는다. 앱의 ‘내 취재 수첩’은 기기 안에만 저장한다.
- 의학·통계·시장 정보는 검수 전 초안일 수 있다. 항목마다 기준일과 출처를 확인한다.
