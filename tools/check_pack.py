#!/usr/bin/env python3
# 콘텐츠 팩·백과·통계·마스터 색인 점검(기획안 1의 12.7 루브릭 자동 부분, 기획안 2의 4.2·4.6).
# 사용: python3 tools/check_pack.py drafts/packs/pipeline/W00.json [파일 ...]
# 오류가 있으면 종료 코드 1. 분포(블룸·난이도)는 참고 경고로만 낸다.
import json
import re
import sys

BLOOM_LOW = ('remember',)
BLOOM_HIGH = ('apply', 'analyze', 'evaluate', 'create')
AXES = ('science', 'industry', 'media')
TYPES = ('mcq', 'multi', 'cloze', 'short', 'order', 'match', 'numeric', 'estimate', 'hotspot', 'chart', 'case', 'oral', 'desk')
REAL_COMPANIES = ('삼성바이오', '셀트리온', '유한양행', '한미약품', '대웅제약', '종근당', 'SK바이오', '녹십자', 'GC녹십자', '알테오젠', '리가켐')


def pct(n, d):
    return 0 if not d else round(100.0 * n / d)


def check_pack(path, data, errs, warns):
    ids = {}
    for key in ('units', 'lessons', 'cards', 'items', 'exams', 'sources', 'dailyReleases', 'dealRounds', 'cases', 'stats', 'entries'):
        for x in data.get(key, []) or []:
            i = x.get('id')
            if not i:
                errs.append(key + ': id 없음')
                continue
            if i in ids:
                errs.append('id 중복: ' + i)
            ids[i] = key
    src = {s['id'] for s in data.get('sources', []) if s.get('id')}
    items = data.get('items', []) or []
    for it in items:
        i = it.get('id', '?')
        for f in ('type', 'domain', 'axis', 'bloom', 'difficulty', 'stem', 'explanation'):
            if it.get(f) in (None, '', []):
                errs.append(i + ': ' + f + ' 없음')
        if it.get('type') not in TYPES:
            errs.append(i + ': 모르는 유형 ' + str(it.get('type')))
        for a in it.get('axis', []) or []:
            if a not in AXES:
                errs.append(i + ': 축 오류 ' + a)
        opts = it.get('options') or []
        if it.get('type') in ('mcq', 'multi', 'order', 'hotspot'):
            if not opts:
                errs.append(i + ': options 없음')
            for o in opts:
                if not o.get('rationale'):
                    errs.append(i + ': 선택지 ' + str(o.get('id')) + ' rationale 없음')
            nc = sum(1 for o in opts if o.get('correct'))
            if it.get('type') == 'mcq' and nc != 1:
                errs.append(i + ': mcq 정답 수 ' + str(nc))
            if it.get('type') == 'multi' and nc < 1:
                errs.append(i + ': multi 정답 없음')
            if it.get('type') == 'mcq' and opts:
                lens = [len(o.get('text', '')) for o in opts]
                if max(lens) > 2.5 * max(1, min(lens)) and max(lens) > 30:
                    warns.append(i + ': 선택지 길이 차이가 큼(정답 단서 우려)')
            texts = ' '.join(o.get('text', '') for o in opts)
            if re.search('모두 정답|정답 없음', texts):
                errs.append(i + ': ‘모두 정답/정답 없음’ 선택지')
        if it.get('type') in ('numeric', 'order', 'match', 'cloze', 'estimate') and it.get('answer') is None:
            errs.append(i + ': answer 없음')
        if it.get('type') == 'order':
            oid = {o.get('id') for o in opts}
            if sorted(it.get('answer') or []) != sorted(oid):
                errs.append(i + ': order answer와 options 불일치')
        for s in it.get('sourceIds', []) or []:
            if s not in src:
                errs.append(i + ': 없는 출처 ' + s)
        for c in it.get('cardIds', []) or []:
            if c not in ids:
                warns.append(i + ': 이 파일에 없는 카드 ' + c)
        body = it.get('stem', '') + ' '.join(o.get('text', '') for o in opts)
        for name in REAL_COMPANIES:
            if name in body:
                warns.append(i + ': 실존 기업명 ' + name + ' — 공개 자료로 확인한 사실인지 점검')
    for ex in data.get('exams', []) or []:
        for r in ex.get('itemIds', []) or []:
            if r not in ids:
                errs.append(ex.get('id', '?') + ': 없는 문항 ' + r)
    for ls in data.get('lessons', []) or []:
        refs = (ls.get('cardIds') or []) + (ls.get('pretestItemIds') or []) + [c.get('checkItemId') for c in ls.get('chunks', []) if c.get('checkItemId')]
        for r in refs:
            if r not in ids:
                warns.append(ls.get('id', '?') + ': 이 파일에 없는 참조 ' + r)
    for c in data.get('cards', []) or []:
        for f in ('front', 'back', 'domain', 'axis', 'difficulty'):
            if c.get(f) in (None, '', []):
                errs.append(c.get('id', '?') + ': ' + f + ' 없음')
    n = len(items)
    if n:
        low = sum(1 for x in items if x.get('bloom') in BLOOM_LOW)
        high = sum(1 for x in items if x.get('bloom') in BLOOM_HIGH)
        d12 = sum(1 for x in items if x.get('difficulty') in (1, 2))
        d3 = sum(1 for x in items if x.get('difficulty') == 3)
        d45 = sum(1 for x in items if x.get('difficulty') in (4, 5))
        print('  문항 %d · 블룸 기억 %d%% 적용 이상 %d%% · 난이도 1~2 %d%% / 3 %d%% / 4~5 %d%%' % (n, pct(low, n), pct(high, n), pct(d12, n), pct(d3, n), pct(d45, n)))
        if pct(low, n) > 30:
            warns.append('블룸: 기억 %d%% (기준 30%% 이하)' % pct(low, n))
        if pct(high, n) < 40:
            warns.append('블룸: 적용 이상 %d%% (기준 40%% 이상)' % pct(high, n))
        nv = sum(1 for x in items if x.get('needsVerification'))
        if nv:
            print('  검증 필요 표시 문항 %d' % nv)


def check_stats(data, errs, warns):
    src = {s['id'] for s in data.get('sources', []) if s.get('id')}
    seen = set()
    for r in data.get('stats', []):
        i = r.get('id', '?')
        if not re.match(r'^ST-[0-9]{4}$', i):
            errs.append(i + ': id 형식(ST-0000) 아님')
        if i in seen:
            errs.append('id 중복: ' + i)
        seen.add(i)
        for f in ('label', 'value', 'unit', 'population', 'period', 'definition', 'sourceId', 'publishedAt', 'reviewBy'):
            if r.get(f) in (None, ''):
                errs.append(i + ': ' + f + ' 없음')
        if r.get('sourceId') not in src:
            errs.append(i + ': 없는 출처 ' + str(r.get('sourceId')))
    nv = sum(1 for r in data.get('stats', []) if r.get('needsVerification'))
    print('  통계 %d · 출처 %d · 검증 필요 %d' % (len(data.get('stats', [])), len(src), nv))


def check_index(rows, errs, warns):
    ids = {}
    for r in rows:
        i = r.get('id', '?')
        if not re.match(r'^HB-[A-Z]{2}-[0-9]{4}$', i):
            errs.append(i + ': 주소 형식(HB-XX-0000) 아님')
        if i in ids:
            errs.append('주소 중복: ' + i)
        ids[i] = r
    titles = {}
    for r in rows:
        t = r.get('title')
        if t in titles:
            errs.append('표제 중복: ' + str(t))
        titles[t] = 1
        for p in r.get('plannedRelations', []):
            tgt = p.split(':', 1)[-1]
            if tgt not in ids:
                errs.append(r.get('id', '?') + ': 없는 링크 ' + p)
    print('  색인 %d행' % len(rows))


def main(paths):
    bad = 0
    for path in paths:
        errs, warns = [], []
        print(path)
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
        if isinstance(data, list):
            check_index(data, errs, warns)
        else:
            if data.get('stats'):
                check_stats(data, errs, warns)
            check_pack(path, data, errs, warns)
        for w in warns[:20]:
            print('  ! ' + w)
        if len(warns) > 20:
            print('  ! 외 %d건' % (len(warns) - 20))
        for e in errs:
            print('  ✕ ' + e)
        if errs:
            bad += 1
        else:
            print('  ✓ 오류 없음')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
