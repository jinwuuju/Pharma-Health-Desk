# 콘텐츠 원본

| 경로 | 내용 | 스키마 |
|---|---|---|
| `packs/pipeline/Wnn.json` | 코스 1 주차별 학습 팩 | 기획안 1의 10.2 ContentPack |
| `packs/healthbeat/Wnn.json` | 코스 2 주차별 학습 팩(courseId 'healthbeat') | 기획안 1의 10.2 + 기획안 2의 13 |
| `canon/master-index.json` | 코스 2 백과 마스터 색인 | 기획안 2의 13 MasterIndexRow[] |
| `canon/*.json` | 백과 항목 배치 | 기획안 2의 13 CanonPack |
| `registry/stats-nnn.json` | 통계 레지스트리 | CanonPack 모양 `{packId, courseId, stats: StatRecord[], sources}` (D015) |

규칙
- 파일 이름은 영문·숫자·하이픈만. 주차는 두 자리(W01).
- 만들면 바로 넣고 팩 최상위에 `review: draft`를 단다. 감수는 전부 만든 뒤 다른 대화에서 일괄로 한다(D017, `docs/production/REVIEW-QUEUE.md`).
- 앱 기본 탑재 팩은 `site/packs/`로 복사하고 `site/packs/index.json` 목록에 더한다(D007·D017).
- 공개 저장소다(D008). 취재원·개인 메모·백업을 넣지 않는다.
