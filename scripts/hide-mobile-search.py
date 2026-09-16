from pathlib import Path

p = Path('index.html')
text = p.read_text(encoding='utf-8')
old = '''      .header-search-container {
        width: 100%;
        max-width: none;
      }'''
new = '''      .header-search-container {
        display: none !important;
      }
      .header-search-results,
      .search-type-dropdown {
        display: none !important;
      }'''
count = text.count(old)
if count == 0:
    print('already patched or target missing')
elif count != 1:
    raise SystemExit(f'expected 1 match, got {count}')
else:
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('patched ok')
