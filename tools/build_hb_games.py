#!/usr/bin/env python3
# 코스 2(HEALTH BEAT) 게임 팩 생성기(D019·D020). 원본: 이 파일의 연금술·오보 함정·근거 사다리 정의 + data/canon/master-index.json + data/registry/stats-001.json
# 출력: data/packs/healthbeat/HB-GAME-001.json, site/packs/hb-games.json, site/packs/index.json 갱신. 감수 전(review: draft).
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = '2026-11-22.2'
PACK_ID = 'HB-GAME-001'

# ---------- 인체 연금술(Little Alchemy형) ----------
# (id, 이름, 아이콘, 재료 A, 재료 B, 정의, 기자 포인트) — 재료가 없으면 기본 원소
AL = [
  ('cell', '세포', '🔬', None, None, '생명의 기본 단위. 사람 몸은 수십조 개의 세포로 이루어져 있다.', ''),
  ('blood', '혈액', '🩸', None, None, '혈장(액체)과 적혈구·백혈구·혈소판으로 이루어져 산소·영양·노폐물을 나른다.', ''),
  ('air', '공기', '💨', None, None, '숨 쉴 때 들이마시는 기체. 몸이 쓰는 것은 그중 약 21%를 차지하는 산소다.', ''),
  ('food', '음식', '🍚', None, None, '몸의 연료이자 재료. 소화되어 포도당·지방산·아미노산 등으로 흡수된다.', ''),
  ('signal', '신호', '⚡', None, None, '세포끼리 정보를 주고받는 수단. 신경의 전기 신호와 호르몬 같은 화학 신호가 있다.', ''),
  ('time', '시간', '⏳', None, None, '나이가 들고 노출이 쌓이는 것. 만성질환과 노화를 이해하는 핵심 재료다.', ''),
  ('tissue', '조직', '🧩', 'cell', 'cell', '비슷한 세포가 모여 같은 일을 하는 무리. 상피·결합·근육·신경 조직 네 가지로 나눈다.', ''),
  ('organ', '장기', '', 'tissue', 'tissue', '여러 조직이 모여 한 가지 일을 맡는 구조. 의학 용어로는 ‘기관(器官)’이라고 한다.', '‘기관(器官)’은 숨길인 ‘기관(氣管)’과 소리가 같아 기사에서 헷갈리기 쉽다.'),
  ('system', '계통', '🗂️', 'organ', 'organ', '같은 목적을 위해 함께 일하는 장기 묶음. 순환계·호흡계처럼 ‘~계(계통)’로 부른다.', '통계에선 ‘순환계통 질환’처럼 질병 분류의 큰 묶음 이름으로도 쓰인다.'),
  ('heart', '심장', '🫀', 'organ', 'blood', '혈액을 온몸으로 뿜어내는 근육 펌프. 안정 시 1분에 60~100번 뛴다.', ''),
  ('lung', '폐', '🫁', 'organ', 'air', '들이마신 공기의 산소를 혈액에 넘기고 이산화탄소를 내보내는 장기. 이 교환은 폐포에서 일어난다.', ''),
  ('stomach', '위', '', 'organ', 'food', '음식을 잠시 담아 두고 위산과 소화 효소로 잘게 부수는 주머니 모양의 소화 기관.', ''),
  ('brain', '뇌', '🧠', 'organ', 'signal', '신경 신호를 모아 판단하고 몸 전체를 조절하는 중추 기관.', ''),
  ('vessel', '혈관', '', 'tissue', 'blood', '혈액이 지나는 관. 심장에서 나가는 동맥, 돌아오는 정맥, 그 사이의 모세혈관이 있다.', ''),
  ('circ', '순환계', '', 'heart', 'vessel', '심장·혈관·혈액이 온몸에 산소와 영양을 나르고 노폐물을 거두는 계통.', '2025년 사망원인 2위 심장 질환, 4위 뇌혈관 질환이 모두 이 계통의 병이다.'),
  ('resp', '호흡계', '', 'lung', 'air', '코·인두·후두·기관·기관지·폐로 이어져 산소를 들이고 이산화탄소를 내보내는 계통.', ''),
  ('digest', '소화계', '', 'stomach', 'food', '입에서 항문까지 이어진 소화관과 간·쓸개·췌장이 음식을 분해·흡수하는 계통.', ''),
  ('nerve', '신경계', '', 'brain', 'signal', '뇌·척수(중추)와 온몸의 신경(말초)이 전기 신호로 감각·운동·자율 기능을 조절하는 계통.', ''),
  ('alcohol', '술', '🍺', 'food', 'time', '곡물·과일의 당이 효모에 의해 발효되어 생긴 에탄올이 든 음료.', '국제암연구소(IARC)는 알코올 음료를 1군 발암물질로 분류한다.'),
  ('liver', '간', '', 'organ', 'alcohol', '알코올·약물 같은 물질을 분해(대사)하고 영양을 저장하는, 몸 안에서 가장 큰 장기.', ''),
  ('metab', '대사', '', 'cell', 'food', '세포가 영양소에서 에너지를 꺼내 쓰고 몸의 재료를 만드는 화학 반응 전체.', ''),
  ('waste', '노폐물', '', 'metab', 'blood', '대사 뒤에 남는 쓸모없는 물질. 단백질이 분해되며 생기는 요소, 근육에서 나오는 크레아티닌 등이 있다.', ''),
  ('kidney', '콩팥', '🫘', 'waste', 'organ', '혈액을 걸러 노폐물과 남는 물을 소변으로 내보내는 장기(신장). 혈압·전해질 조절도 맡는다.', '콩팥 기능은 혈액 크레아티닌으로 계산한 사구체여과율(eGFR)로 흔히 표시한다.'),
  ('hormone', '호르몬', '', 'signal', 'blood', '내분비샘에서 나와 혈액을 타고 멀리 있는 장기에 전달되는 화학 신호 물질.', ''),
  ('insulin', '인슐린', '💉', 'hormone', 'food', '식사 뒤 췌장에서 나와 혈액의 포도당을 세포 안으로 들여보내 혈당을 낮추는 호르몬.', ''),
  ('glucose', '혈당', '🍬', 'food', 'blood', '혈액 속 포도당 농도. 공복 혈당은 100mg/dL 미만이 정상이다.', ''),
  ('diabetes', '당뇨병', '', 'glucose', 'time', '인슐린이 부족하거나 잘 듣지 않아 혈당이 높은 상태가 계속되는 병. 공복 혈당 126mg/dL 이상 등으로 진단한다.', '국내 환자 대부분은 2형이다. 1형과 2형은 원인이 달라 구분해 쓴다.'),
  ('fat', '지방', '🧈', 'food', 'food', '같은 무게에서 에너지가 가장 많은 영양소(1g당 9kcal). 쓰고 남은 에너지는 지방 조직에 저장된다.', ''),
  ('obesity', '비만', '', 'fat', 'time', '몸에 지방이 지나치게 쌓인 상태. 국내 기준은 체질량지수(BMI) 25 이상이다.', 'WHO 기준은 BMI 30 이상이라, 나라 간 비만율을 비교할 땐 기준부터 확인한다.'),
  ('athero', '죽상경화', '', 'vessel', 'fat', '혈관 벽에 콜레스테롤 등이 쌓여 동맥이 좁아지고 딱딱해지는 변화. 흔히 동맥경화라고 부른다.', ''),
  ('mi', '심근경색', '', 'athero', 'heart', '심장 근육에 피를 대는 관상동맥이 막혀 근육이 죽는 응급 질환.', '갑자기 심한 가슴 통증이 이어지면 바로 119에 연락하도록 기사에 대처법을 함께 쓴다.'),
  ('infarct', '뇌경색', '', 'athero', 'brain', '뇌혈관이 막혀 뇌 조직이 손상되는 뇌졸중. 뇌졸중 가운데 가장 흔한 형태다.', ''),
  ('bp', '혈압', '', 'blood', 'vessel', '혈액이 혈관 벽을 미는 압력. ‘120/80mmHg’처럼 수축기/이완기로 적는다.', ''),
  ('htn', '고혈압', '', 'bp', 'time', '혈압이 높은 상태가 계속되는 병. 국내 진단 기준은 140/90mmHg 이상이다.', '미국 지침은 130/80mmHg부터 고혈압으로 본다. 기준이 다르면 유병률도 달라진다.'),
  ('microbe', '미생물', '🦠', 'cell', 'air', '눈에 보이지 않을 만큼 작은 생물. 세균·곰팡이 등이며, 바이러스도 흔히 함께 묶어 부른다.', ''),
  ('infect', '감염', '', 'microbe', 'blood', '병원체가 몸에 들어와 자리 잡고 늘어나는 것. 증상이 없는 감염도 있다.', ''),
  ('pneumonia', '폐렴', '', 'infect', 'lung', '폐에 생긴 염증. 대개 세균·바이러스 감염이 원인이다.', '2025년 국내 사망원인 3위. 고령층에서 특히 위험하다.'),
  ('hepatitis', '간염', '', 'infect', 'liver', '간에 생긴 염증. B형·C형 간염 바이러스, 술, 약물 등이 원인이다.', ''),
  ('cirrhosis', '간경변', '', 'hepatitis', 'time', '오랜 손상으로 간에 흉터 조직이 생기고 굳어 기능이 떨어진 상태.', ''),
  ('fattyliver', '지방간', '', 'fat', 'liver', '간세포에 지방이 지나치게 쌓인 상태. 술 때문인 것과 대사 이상 때문인 것으로 나눈다.', ''),
  ('cells', '혈구', '', 'blood', 'cell', '혈액 속 세포. 산소를 나르는 적혈구, 몸을 지키는 백혈구, 피를 멈추게 하는 혈소판.', ''),
  ('immune', '면역', '🛡️', 'cells', 'microbe', '몸이 병원체 같은 침입자를 알아보고 물리치는 방어 체계. 한 번 만난 적을 기억하기도 한다.', ''),
  ('vaccine', '백신', '', 'immune', 'microbe', '병원체를 약하게 하거나 그 일부만 보여 줘 면역 기억을 미리 만드는 약.', '효과(예방률)는 ‘걸릴 위험이 얼마나 줄었나’로 읽는다. ‘100% 예방’으로 쓰지 않는다.'),
  ('inflam', '염증', '🔥', 'immune', 'tissue', '손상·감염에 대한 몸의 방어 반응. 붉어짐·열감·부기·통증이 나타난다.', ''),
  ('drug', '약', '💊', 'metab', 'signal', '몸의 신호나 대사에 작용해 기능을 바꾸려고 쓰는 물질.', '같은 성분도 용량·대상에 따라 효과와 부작용이 달라 ‘효과 있다’만 쓰지 않는다.'),
  ('abx', '항생제', '', 'drug', 'microbe', '세균을 죽이거나 자라지 못하게 하는 약.', '감기 같은 바이러스 감염에는 듣지 않는다.'),
  ('amr', '항생제 내성', '', 'abx', 'time', '항생제를 남용하거나 잘못 쓰면 살아남은 세균이 퍼져 약이 듣지 않게 되는 현상.', ''),
  ('aging', '노화', '', 'cell', 'time', '세포와 조직의 기능이 시간이 지나며 서서히 떨어지는 과정. 그 자체는 병이 아니다.', ''),
  ('gene', '유전자', '🧬', 'cell', 'signal', '단백질을 만드는 설계 정보. 세포핵 속 DNA에 담겨 있다.', ''),
  ('mutation', '돌연변이', '', 'gene', 'time', 'DNA 정보가 바뀌는 것. 나이·흡연·자외선 등으로 쌓이며, 모두 병을 일으키지는 않는다.', ''),
  ('cancer', '암', '', 'mutation', 'cell', '세포가 통제를 벗어나 계속 늘어나고 다른 곳으로 퍼지는 병.', '2025년 국내 사망원인 1위다.'),
  ('lungca', '폐암', '', 'cancer', 'lung', '폐에 생긴 암. 국내 암 사망 1위이며 흡연이 가장 큰 위험 요인이다.', ''),
  ('liverca', '간암', '', 'cancer', 'liver', '간에 생긴 암. B형·C형 간염과 간경변이 주요 위험 요인이다.', ''),
  ('gastricca', '위암', '', 'cancer', 'stomach', '위에 생긴 암. 국가암검진은 40세 이상에게 2년마다 위내시경 검사를 권한다.', ''),
  ('habit', '습관', '', 'nerve', 'time', '반복으로 굳어진 행동. 건강에서는 흡연·음주·운동·식사 습관이 핵심이다.', ''),
  ('smoking', '흡연', '🚬', 'habit', 'air', '담배 연기를 들이마시는 것. 폐암·심혈관질환·COPD의 주요 위험 요인이다.', ''),
  ('copd', 'COPD', '', 'smoking', 'lung', '주로 흡연 탓에 기도와 폐가 손상돼 숨길이 계속 좁아지는 병(만성폐쇄성폐질환).', ''),
  ('exercise', '운동', '🏃', 'habit', 'heart', '심장과 근육을 쓰는 신체 활동.', 'WHO는 성인에게 주 150~300분의 중강도 유산소 활동을 권한다.'),
  ('hemorrhage', '뇌출혈', '', 'htn', 'brain', '뇌혈관이 터져 뇌 안에 피가 고이는 뇌졸중. 고혈압이 가장 큰 위험 요인이다.', ''),
  ('dementia', '치매', '', 'brain', 'aging', '기억력 등 인지 기능이 떨어져 일상생활이 어려워진 상태. 알츠하이머병이 가장 흔한 원인이다.', '정상 노화와 다르다. ‘나이 들면 다 치매’라고 쓰지 않는다.'),
  ('bpdrug', '혈압약', '', 'drug', 'htn', '혈압을 낮추는 약. 이뇨제·칼슘 통로 차단제·ACE 억제제 등 여러 계열이 있다.', ''),
  ('dmdrug', '당뇨병 약', '', 'drug', 'diabetes', '혈당을 낮추는 약. 2형 당뇨병에선 메트포르민이 대표적인 첫 약이다.', ''),
  ('chemo', '항암제', '', 'drug', 'cancer', '암세포를 죽이거나 자라지 못하게 하는 약. 세포독성·표적·면역항암제로 나눈다.', ''),
  ('io', '면역항암제', '', 'immune', 'cancer', '면역세포가 암을 다시 공격하도록 브레이크를 풀어 주는 약(예: PD-1 억제제).', '모든 환자에게 듣지는 않는다. ‘꿈의 항암제’ 같은 표현은 피한다.'),
]

# ---------- 근거 사다리(오보 지뢰찾기에서 함정을 만나면 해당 단계 카드가 열린다, D020) ----------
EV = [
  ('일화', '🗣️', '한 사람의 경험담(‘먹고 나았다’). 우연·자연 회복·위약 효과를 걸러 내지 못한다.', '체험담은 근거가 아니라 취재의 출발점이다.'),
  ('세포·동물 실험', '🐭', '실험실의 세포나 동물에서 본 결과. 원리를 보여 주지만 사람에게 그대로 들어맞지 않는 경우가 많다.', '‘쥐에서 효과’를 ‘치료 효과’로 쓰지 않는다.'),
  ('전문가 의견', '🎓', '자료 분석 없이 경험과 이론에 기댄 견해. 근거 수준으로는 낮은 편이다.', '전문가의 말도 어떤 연구에 근거했는지 묻는다.'),
  ('사례 보고', '📄', '환자 한 명이나 몇 명의 특이한 경과를 자세히 기록한 보고. 새 질병·부작용의 첫 신호가 된다.', '비교군이 없어 효과를 증명하지 못한다.'),
  ('단면 연구', '📸', '한 시점에 여러 사람을 조사해 질병과 요인의 관계를 보는 연구(설문·검진 자료 등).', '원인과 결과의 선후를 알 수 없다.'),
  ('환자-대조군 연구', '⚖️', '병이 있는 사람과 없는 사람의 과거 노출을 비교하는 연구. 드문 병을 연구할 때 유리하다.', '기억에 기댄 답(회상 편향)에 주의한다.'),
  ('코호트 연구', '👥', '노출된 집단과 아닌 집단을 시간에 따라 따라가며 병이 생기는지 보는 연구.', '연관성은 보여도 인과를 단정하지 못한다. 교란 변수를 확인한다.'),
  ('무작위 대조 시험', '🎲', '참여자를 무작위로 나눠 한쪽만 치료하고 결과를 비교하는 연구(RCT). 인과를 보기에 가장 강한 단일 연구 설계다.', '대상·기간·평가 지표가 기사 속 주장과 맞는지 본다.'),
  ('메타분석', '📚', '같은 질문을 다룬 연구를 빠짐없이 모아 질을 평가하고(체계적 문헌고찰), 결과를 통계적으로 합친 연구.', '질 낮은 연구를 모으면 결론도 약하다.'),
  ('진료지침', '🏛️', '근거를 종합하고 이익과 위해를 따져 학회 등이 내놓는 진료 권고. 권고마다 근거 수준과 강도가 붙는다.', '지침은 개정된다. 기사에선 발표 연도와 기관을 쓴다.'),
]

# ---------- 오보 지뢰찾기(지뢰찾기형, D020) ----------
# (id, 함정 이름, 아이콘, 나쁜 제목 예시, [정답, 오답, 오답], 해설, 관련 근거 사다리 단계)
TR = [
  ('anecdote', '체험담을 근거로', '🗣️', '“○○즙 먹고 3주 만에 혈당 정상” — 독자 제보로 본 효과', ['한 사람의 경험담을 효과의 근거로 썼다', '혈당 단위를 빠뜨렸다', '기간을 3주로 짧게 잡았다'], '체험담은 우연·자연 회복·위약 효과를 가려내지 못한다. 근거 사다리 맨 아래(일화)다.', 1),
  ('mouse', '쥐 실험을 치료 효과로', '🐭', '“○○ 성분, 치매 치료 길 열었다” — 생쥐 실험 결과', ['동물 실험 결과를 사람 치료 효과처럼 썼다', '생쥐 수를 밝히지 않았다', '치매를 질병으로 다뤘다'], '세포·동물 결과는 사람에서 재현되지 않는 경우가 많다. 제목부터 ‘동물 실험에서’라고 밝힌다.', 2),
  ('expert', '전문가 한 명의 말만', '🎓', '“이 영양제면 면역력 2배” — 한 대학병원 교수', ['연구 근거 없이 전문가 한 명의 말만 옮겼다', '교수의 소속을 밝혔다', '면역력이라는 단어를 썼다'], '전문가 의견은 근거 수준이 낮다. 어떤 연구에 근거했는지 묻고 다른 전문가의 의견도 듣는다.', 3),
  ('coi', '이해관계 숨기기', '💼', '“○○ 유산균, 장 건강 개선” — 제조사가 지원한 연구, 기사엔 언급 없음', ['연구비를 댄 회사(이해관계)를 밝히지 않았다', '유산균 이름을 썼다', '장 건강을 다뤘다'], '기업이 지원한 연구는 그 사실을 밝히고, 독립적인 연구가 있는지 함께 본다.', 3),
  ('case', '환자 몇 명으로 일반화', '📄', '“신약 투여 환자 3명 모두 호전”', ['비교군 없는 소수 사례로 효과를 일반화했다', '환자 이름을 가렸다', '신약 이름을 밝혔다'], '사례 보고는 새 신호를 알리지만 비교군이 없어 효과를 증명하지 못한다.', 4),
  ('cross', '선후 관계 뒤집기', '📸', '“스마트폰 오래 보는 청소년 우울감 높아… 스마트폰이 우울증 부른다” — 설문 조사', ['한 시점 설문으로 원인과 결과를 단정했다', '청소년을 대상으로 했다', '우울감을 측정했다'], '단면 연구는 무엇이 먼저인지 알 수 없다. 우울해서 스마트폰을 더 볼 수도 있다.', 5),
  ('recall', '기억에 기댄 답을 사실로', '⚖️', '“폐암 환자들, 과거 ○○를 즐겨 먹었다고 답해… ○○가 폐암 원인”', ['환자들의 기억에 기댄 비교를 원인 확정처럼 썼다', '폐암 환자를 조사했다', '음식 이름을 밝혔다'], '환자-대조군 연구는 회상 편향에 흔들릴 수 있다. ‘연관이 있었다’로 쓴다.', 6),
  ('causal', '연관을 인과로', '👥', '“커피 하루 3잔, 사망 위험 낮춘다” — 10만 명 추적 연구', ['관찰 연구의 연관성을 ‘낮춘다’는 인과로 썼다', '참여자 수를 밝혔다', '커피 잔 수를 구체적으로 썼다'], '코호트 연구는 연관성을 보여 줄 뿐이다. 원래 건강한 사람이 커피를 더 마셨을 수도 있다(교란). ‘~와 관련’으로 쓴다.', 7),
  ('relative', '상대 위험만 쓰기', '📈', '“○○ 식품, 대장암 위험 18% 높여” — 실제 몇 명이 걸리는지는 없음', ['상대 위험만 쓰고 실제(절대) 위험을 빠뜨렸다', '암 종류를 밝혔다', '퍼센트를 썼다'], '18% 증가가 100명 중 몇 명에서 몇 명이 되는 것인지(절대 위험)를 함께 써야 독자가 크기를 안다.', 7),
  ('surrogate', '대리 지표를 생명 연장으로', '🎯', '“신약, 종양 크기 줄여… 생명 연장 기대”', ['종양 크기 같은 대리 지표를 생존 연장처럼 썼다', '종양을 측정했다', '신약이라고 불렀다'], '종양 축소·수치 개선은 대리 지표다. 실제로 더 오래 사는지(전체 생존)는 따로 확인한다.', 8),
  ('abstract', '중간 결과를 ‘입증’으로', '🧾', '“○○ 치료제, 효과 입증” — 학회 포스터의 중간 결과', ['동료 심사 전 중간 결과를 ‘입증’으로 썼다', '학회 이름을 밝혔다', '치료제라고 불렀다'], '학회 초록·중간 결과는 바뀔 수 있다. ‘발표했다’로 쓰고 최종 결과와 논문 게재 여부를 확인한다.', 8),
  ('pvalue', '유의하면 효과가 크다?', '🔢', '“통계적으로 유의한 차이… 획기적 효과”', ['통계적 유의성을 효과의 크기로 착각했다', '통계를 언급했다', '차이가 있다고 썼다'], '‘유의하다’는 우연일 가능성이 낮다는 뜻이지 효과가 크다는 뜻이 아니다. 효과의 크기를 숫자로 쓴다.', 8),
  ('miracle', '꿈의·기적의 과장', '✨', '“부작용 없는 꿈의 항암제”', ['근거 없는 과장 표현(꿈의·부작용 없는)을 썼다', '항암제라고 불렀다', '따옴표를 썼다'], '모든 약에는 부작용과 효과가 없는 환자가 있다. 수식어를 빼고 숫자로 쓴다.', 8),
  ('vaccine', '100% 예방', '💉', '“이 백신 맞으면 독감 절대 안 걸린다”', ['예방 효과를 ‘절대 안 걸린다’로 과장했다', '독감을 다뤘다', '백신 접종을 권했다'], '백신 효과는 걸릴 위험이 얼마나 줄었나로 읽는다. 맞아도 걸릴 수 있다.', 8),
  ('meta', '모으기만 하면 확실?', '📚', '“연구 20편 메타분석… 효과 확실”', ['포함된 연구의 질을 따지지 않았다', '연구 수를 밝혔다', '메타분석이라고 썼다'], '질 낮은 연구를 모은 메타분석은 결론도 약하다. 포함된 연구의 설계와 결과의 차이(이질성)를 본다.', 9),
  ('guideline', '옛 지침을 지금 권고로', '🏛️', '“학회 권고: 콜레스테롤 목표치는 ○○” — 10년 전 지침 인용', ['개정 전 옛 지침을 현재 권고처럼 썼다', '학회 이름을 밝혔다', '목표치를 숫자로 썼다'], '지침은 개정된다. 발표 연도·기관과 최신판인지 확인한다.', 10),
]

LENS = {'mortality': '사망', 'utilization': '진료', 'news': '뉴스', 'burden': '부담', 'cost': '비용'}

def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return json.load(fh)

def short(title):
    return re.sub(r'[(].*?[)]', '', title).strip()

def week_num(w):
    m = re.match(r'W(\d+)', w or '')
    return int(m.group(1)) if m else None

def fmt(v):
    if isinstance(v, int) or (isinstance(v, float) and v.is_integer()):
        return '{:,}'.format(int(v))
    return '{:,}'.format(v)

def build():
    idx = load('data/canon/master-index.json')
    reg = load('data/registry/stats-001.json')
    by = {r['id']: r for r in idx}
    names = {a[0]: a for a in AL}
    elements, recipes, cards = [], [], []
    seen_pairs = {}
    for i, (eid, name, icon, a, b, d, note) in enumerate(AL):
        el = {'id': 'HB-AL-' + eid, 'courseId': 'healthbeat', 'name': name, 'icon': icon, 'base': a is None, 'order': i, 'def': d}
        if note:
            el['note'] = note
        elements.append(el)
        if a is None:
            continue
        assert a in names and b in names, eid
        key = '+'.join(sorted([a, b]))
        assert key not in seen_pairs, (key, eid, seen_pairs.get(key))
        seen_pairs[key] = eid
        recipes.append({'id': 'HB-RC-' + eid, 'courseId': 'healthbeat', 'a': 'HB-AL-' + a, 'b': 'HB-AL-' + b, 'result': 'HB-AL-' + eid})
        A, B = names[a], names[b]
        card = {'id': 'HB-C-AL-' + eid, 'courseId': 'healthbeat', 'domain': '인체 연금술', 'axis': ['science'], 'tags': ['W01', 'alchemy'],
                'front': '{} {} + {} {} = ?'.format(A[2] or '◻︎', A[1], B[2] or '◻︎', B[1]),
                'back': '{} — {}'.format(name, d), 'unlock': {'type': 'al', 'id': 'HB-AL-' + eid}, 'difficulty': 1}
        if note:
            card['why'] = note
        cards.append(card)
    evidence = []
    for n, (name, icon, d, note) in enumerate(EV, start=1):
        evidence.append({'id': 'HB-EV-%02d' % n, 'courseId': 'healthbeat', 'level': n, 'name': name, 'icon': icon, 'def': d, 'note': note})
        cards.append({'id': 'HB-C-EV-%02d' % n, 'courseId': 'healthbeat', 'domain': '근거 사다리', 'axis': ['science', 'media'], 'tags': ['evidence'],
                      'front': '근거 사다리 {}단계 {} ‘{}’ — 무엇이고, 기사에서 조심할 점은?'.format(n, icon, name),
                      'back': d, 'why': note, 'unlock': {'type': 'ev', 'id': 'HB-EV-%02d' % n}, 'difficulty': 2})
    traps = []
    for n, (tid, title, icon, head, choices, why, level) in enumerate(TR, start=1):
        traps.append({'id': 'HB-TR-' + tid, 'courseId': 'healthbeat', 'order': n, 'title': title, 'icon': icon, 'headline': head,
                      'choices': choices, 'answer': 0, 'why': why, 'level': level, 'evidenceId': 'HB-EV-%02d' % level})
        cards.append({'id': 'HB-C-TR-' + tid, 'courseId': 'healthbeat', 'domain': '오보 지뢰찾기', 'axis': ['media', 'science'], 'tags': ['trap'],
                      'front': '🚨 {} — 이 제목의 문제는?'.format(head), 'back': '{}: {}'.format(title, choices[0]), 'why': why,
                      'unlock': {'type': 'tr', 'id': 'HB-TR-' + tid}, 'difficulty': 2})
    diseases = []
    for r in idx:
        if r.get('type') != 'disease':
            continue
        rel = {}
        for x in r.get('plannedRelations', []):
            k, _, v = x.partition(':')
            rel.setdefault(k, []).append(v)
        def titles(k):
            return [short(by[v]['title']) for v in rel.get(k, []) if v in by]
        system = titles('partOf')
        dz = {'id': r['id'], 'courseId': 'healthbeat', 'name': short(r['title']), 'full': r['title'], 'tier': r.get('tier', ''),
              'system': system[0] if system else '기타', 'week': week_num(r.get('week')), 'lenses': [LENS.get(l, l) for l in r.get('lenses', [])],
              'tests': titles('diagnosedBy'), 'treatments': titles('treatedBy'), 'confusable': titles('confusableWith')}
        diseases.append(dz)
        back = '계통: {}. 검사: {}. 치료: {}.'.format(dz['system'], ', '.join(dz['tests']) or '—', ', '.join(dz['treatments']) or '—')
        card = {'id': 'HB-C-DX-' + r['id'][6:], 'courseId': 'healthbeat', 'domain': '오늘의 진단', 'axis': ['science'], 'tags': ['dx', 'tier-' + dz['tier']],
                'front': '🩺 {} — 어느 계통이고, 무엇으로 진단·치료하나?'.format(dz['name']), 'back': back,
                'unlock': {'type': 'dx', 'id': r['id']}, 'difficulty': 2}
        if dz['confusable']:
            card['why'] = '헷갈리는 병: ' + ', '.join(dz['confusable'])
        cards.append(card)
    for s in reg['stats']:
        if not isinstance(s.get('value'), (int, float)):
            continue
        card = {'id': 'HB-C-ST-' + s['id'][3:], 'courseId': 'healthbeat', 'domain': '오늘의 숫자', 'axis': ['media'], 'tags': ['num'],
                'front': '📊 {} ({}, {})는?'.format(s['label'], s.get('period', ''), s.get('population', '')),
                'back': '{} {} — 공표 {}.'.format(fmt(s['value']), s.get('unit', ''), s.get('publishedAt', '')),
                'why': s.get('definition', ''), 'unlock': {'type': 'num', 'id': s['id']}, 'difficulty': 3}
        if s.get('needsVerification'):
            card['needsVerification'] = True
        cards.append(card)
    pack = {
        'packId': PACK_ID, 'courseId': 'healthbeat', 'version': VERSION, 'week': 1, 'review': 'draft',
        'title': 'HEALTH BEAT 게임 1차 — 인체 연금술·오보 지뢰찾기·오늘의 진단·오늘의 숫자',
        'description': '코스 2를 게임으로 시작한다(D019·D020). 연금술 64원소·조합 58, 오보 함정 16, 근거 사다리 10단계, 질환 비교 퍼즐(마스터 색인 관계), 통계 카드(레지스트리). 발견하면 카드가 취재 덱에 들어간다.',
        'elements': elements, 'recipes': recipes, 'evidence': evidence, 'traps': traps, 'diseases': diseases, 'cards': cards,
    }
    return pack

def main():
    pack = build()
    text = json.dumps(pack, ensure_ascii=False, indent=1) + chr(10)
    for path in ('data/packs/healthbeat/HB-GAME-001.json', 'site/packs/hb-games.json'):
        with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as fh:
            fh.write(text)
    ipath = os.path.join(ROOT, 'site/packs/index.json')
    man = load('site/packs/index.json')
    entry = {'file': 'hb-games.json', 'packId': PACK_ID, 'courseId': 'healthbeat', 'version': VERSION, 'title': pack['title'], 'review': 'draft'}
    rest = [p for p in man['packs'] if p['packId'] != PACK_ID]
    man['packs'] = [entry] + sorted(rest, key=lambda p: 0 if p['courseId'] == 'healthbeat' else 1)
    man['note'] = '앱 기본 탑재 팩 목록(D007·D017·D019). 코스 2(HEALTH BEAT) 먼저. 앱이 열릴 때 빠졌거나 버전이 바뀐 팩을 자동으로 받는다.'
    with open(ipath, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(man, ensure_ascii=False, indent=1) + chr(10))
    c = {}
    for k in ('elements', 'recipes', 'evidence', 'traps', 'diseases', 'cards'):
        c[k] = len(pack[k])
    print('HB-GAME-001', c)
    tiers = {}
    for d in pack['diseases']:
        tiers[d['tier']] = tiers.get(d['tier'], 0) + 1
    print('tiers', tiers, 'lenses', sorted({l for d in pack['diseases'] for l in d['lenses']}))

if __name__ == '__main__':
    main()
