from pathlib import Path
p = Path('live/index.html')
t = p.read_text(encoding='utf-8')
old = "return '<div class=\"train-popup\"><div style=\"background:#07093e;color:#fff;padding:8px 10px;font-weight:700;font-style:italic;\">' + title + '</div><div style=\"padding:8px 10px;color:#07093e;\"><div>Live trip</div><div>' + who + '</div></div></div>';"
new = "return '<div class=\"train-popup\"><div style=\"background:#07093e;color:#fff;padding:8px 10px;font-weight:700;font-style:italic;\">' + title + '</div><div style=\"padding:8px 10px;color:#07093e;\"><div>Live trip</div><div>' + who + '</div><div><a href=\"/live/user.html?uid=' + encodeURIComponent(doc.id) + '\">Open this tracker</a></div></div></div>';"
if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t, encoding='utf-8')
    print('linked')
else:
    print('popup missing')
