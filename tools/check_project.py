#!/usr/bin/env python3
# 저장소 검사. main에 push하기 전에, 그리고 배포 워크플로에서 반드시 통과해야 한다(AGENTS.md 4절).
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REQUIRED = [
    'README.md',
    'AGENTS.md',
    'docs/00-DOCUMENT-MAP.md',
    'docs/00-MASTER-ROADMAP.md',
    'docs/plans/01-PIPELINE.md',
    'docs/plans/02-HEALTH-BEAT.md',
    'docs/plans/03-ONLINE-SCHOOL.md',
    'docs/production/STATUS.md',
    'docs/production/NEXT-STEPS.md',
    'docs/decisions/DECISIONS.md',
    'site/index.html',
    'site/data/project.json',
    'site/css/app.css',
    'site/js/util.js',
    'site/js/store.js',
    'site/js/packs.js',
    'site/js/srs.js',
    'site/js/game.js',
    'site/js/play.js',
    'site/js/alchemy.js',
    'site/js/quiz.js',
    'site/js/mines.js',
    'site/js/arcade.js',
    'site/js/rush.js',
    'site/js/snake.js',
    'site/js/spot.js',
    'site/js/typing.js',
    'site/js/cards.js',
    'tools/hb_ohbo_bank.py',
    'site/js/daily.js',
    'site/js/screens.js',
    'site/js/app.js',
    'site/packs/sample.json',
    'site/packs/index.json',
    'site/packs/hb-games.json',
    'data/packs/healthbeat/HB-GAME-001.json',
    'tools/build_hb_games.py',
    'tools/smoke/smoke.mjs',
    'tools/smoke/srs-sim.mjs',
    'docs/design/UI-PRINCIPLES.md',
    'tools/smoke/package-lock.json',
]

# 공개 저장소에 올리면 안 되는 파일(D008)
FORBIDDEN_EXT = ('.docx', '.doc', '.hwp', '.xlsx', '.pdf', '.m4a', '.mp3', '.wav')
FORBIDDEN_WORDS = ('취재원', 'contacts', 'backup')
STEP_STATUS = ('done', 'doing', 'next', 'todo')
SKIP_DIRS = ('.git', 'node_modules', 'dist', 'backups', 'private')

errors = []
notes = []


def rel(path):
    return os.path.relpath(path, ROOT)


def walk():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            yield os.path.join(base, name)


def check_required():
    for item in REQUIRED:
        if not os.path.isfile(os.path.join(ROOT, item)):
            errors.append('필수 파일 없음: ' + item)


def check_forbidden():
    for path in walk():
        name = os.path.basename(path).lower()
        if name.endswith(FORBIDDEN_EXT):
            errors.append('공개 저장소 금지 형식: ' + rel(path))
        for word in FORBIDDEN_WORDS:
            if word in name:
                errors.append('공개 저장소 금지 이름: ' + rel(path))


def check_json():
    count = 0
    for path in walk():
        if path.endswith('.json'):
            count += 1
            try:
                with open(path, encoding='utf-8') as fh:
                    json.load(fh)
            except Exception as exc:
                errors.append('JSON 오류: ' + rel(path) + ' — ' + str(exc))
    notes.append('JSON 파일 ' + str(count) + '개 파싱')


def check_project():
    path = os.path.join(ROOT, 'site', 'data', 'project.json')
    if not os.path.isfile(path):
        return
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
    except Exception:
        return
    for key in ('updated', 'current', 'next', 'steps', 'courses'):
        if key not in data:
            errors.append('project.json에 ' + key + ' 없음')
    steps = data.get('steps', [])
    ids = set()
    active = 0
    for step in steps:
        for key in ('id', 'title', 'status'):
            if key not in step:
                errors.append('project.json 단계에 ' + key + ' 없음: ' + str(step))
        status = step.get('status')
        if status not in STEP_STATUS:
            errors.append('project.json 단계 상태 오류: ' + str(step.get('id')))
        if status in ('doing', 'next'):
            active += 1
        if status == 'done' and not step.get('date'):
            errors.append('완료 단계에 date 없음: ' + str(step.get('id')))
        if step.get('id') in ids:
            errors.append('단계 id 중복: ' + str(step.get('id')))
        ids.add(step.get('id'))
    if active > 1:
        errors.append('project.json에 진행 중·다음 단계가 2개 이상')
    notes.append('설치 단계 ' + str(len(steps)) + '개 확인')


def extract_scripts(html):
    out = []
    low = html.lower()
    pos = 0
    while True:
        start = low.find('<script', pos)
        if start < 0:
            break
        tag_end = low.find('>', start)
        close = low.find('</script>', tag_end)
        if tag_end < 0 or close < 0:
            break
        tag = low[start:tag_end]
        if 'src=' not in tag and 'json' not in tag:
            out.append(html[tag_end + 1:close])
        pos = close + 9
    return out


def check_scripts():
    node = shutil.which('node')
    if not node:
        notes.append('node 없음: 스크립트 문법 검사 생략')
        return
    targets = []
    tmpdir = tempfile.mkdtemp()
    for path in walk():
        if not rel(path).startswith('site'):
            continue
        if path.endswith('.html'):
            with open(path, encoding='utf-8') as fh:
                blocks = extract_scripts(fh.read())
            for i, block in enumerate(blocks):
                tmp = os.path.join(tmpdir, os.path.basename(path) + '.' + str(i) + '.js')
                with open(tmp, 'w', encoding='utf-8') as out:
                    out.write(block)
                targets.append((rel(path) + ' 스크립트 ' + str(i + 1), tmp))
        elif path.endswith('.js'):
            targets.append((rel(path), path))
    for label, target in targets:
        res = subprocess.run([node, '--check', target], capture_output=True, text=True)
        if res.returncode != 0:
            errors.append('스크립트 문법 오류: ' + label + ' — ' + res.stderr.strip()[:400])
    shutil.rmtree(tmpdir, ignore_errors=True)
    notes.append('스크립트 ' + str(len(targets)) + '개 문법 검사')


def main():
    check_required()
    check_forbidden()
    check_json()
    check_project()
    check_scripts()
    for note in notes:
        print('· ' + note)
    if errors:
        print('검사 실패 ' + str(len(errors)) + '건')
        for err in errors:
            print('  - ' + err)
        sys.exit(1)
    print('검사 통과')


if __name__ == '__main__':
    main()
