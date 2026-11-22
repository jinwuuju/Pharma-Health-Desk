# 콘텐츠 원본

| 경로 | 내용 | 스키마 |
|---|---|---|
| `packs/pipeline/Wnn.json` | 코스 1 주차별 학습 팩 | 기획안 1의 10.2 ContentPack |
| `packs/healthbeat/Wnn.json` | 코스 2 주차별 학습 팩(courseId 'healthbeat') | 기획안 1의 10.2 + 기획안 2의 13 |
| `canon/master-index.json` | 코스 2 백과 마스터 색인 | 기획안 2의 13 MasterIndexRow[] |
| `canon/*.json` | 백과 항목 배치 | 기획안 2의 13 CanonPack |
| `registry/stats-nnn.json` | 통계 레지스트리 | 기획안 2의 13 StatRecord[] |

규칙
- 파일 이름은 영문·숫자·하이픈만. 주차는 두 자리(W01).
- 생성한 대화와 다른 대화에서 감수한 뒤에만 넣는다.
- 앱 기본 탑재가 필요한 팩은 `site/packs/`로 복사한다(D007).
- 공개 저장소다(D008). 취재원·개인 메모·백업을 넣지 않는다.
