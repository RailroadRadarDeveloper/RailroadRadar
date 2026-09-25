from pathlib import Path

BAD = """      try { return new RegExp('(^|[^0-9])' + n.replace("/[.*+?^${}()|[\\\\]\\\\]/g", '\\$&') + '([^0-9]|$)').test(h); }"""

# read file and replace any tripTrainNumMatch try line
import re
PAT = re.compile(r"      try \{ return new RegExp\('(\^\|\[\^0-9\]\)' \+ n\.replace\([^;]+; \}")
GOOD = "      try { return new RegExp('(^|[^0-9])' + String(n).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '([^0-9]|$)').test(h); }"

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    start = t.find('function tripTrainNumMatch')
    if start < 0:
        print('no helper', path)
        return
    end = t.find('async function tripEnrichMbtaStopTimes', start)
    block = t[start:end]
    new_block = re.sub(
        r"try \{ return new RegExp\([^\n]+\n",
        "try { return new RegExp('(^|[^0-9])' + String(n).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '([^0-9]|$)').test(h); }\n",
        block,
        count=1,
    )
    t = t[:start] + new_block + t[end:]
    p.write_text(t, encoding='utf-8')
    print('patched', path)
    # show line
    for line in new_block.splitlines():
        if 'RegExp' in line:
            print(line)

patch('index.html')
patch('mytrips/index.html')
