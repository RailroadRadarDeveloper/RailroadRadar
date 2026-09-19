from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# Hide banners on shared train pages
if 'html.rr-train-page .rr-dev-banner' not in t:
    needle='    html.rr-train-page #loading-screen {\n      display: none !important;\n    }'
    add=needle + '''
    html.rr-train-page .rr-dev-banner,
    html.rr-train-page #offline-banner,
    html.rr-train-page #rr-cookie-bar,
    html.rr-train-page .rr-cookie {
      display: none !important;
    }
    html.rr-train-page #rr-train-page-card .stop-mileage {
      color: #fff !important;
    }'''
    if needle in t:
        t=t.replace(needle, add, 1)
    else:
        # loading-screen rule may be missing; add after train-page body block
        body='''    html.rr-train-page,
    html.rr-train-page body {
      overflow: auto;
      height: auto;
      min-height: 100%;
      background: #07093e;
    }'''
        if body not in t:
            raise SystemExit('train page css missing')
        t=t.replace(body, body + '''
    html.rr-train-page .rr-dev-banner,
    html.rr-train-page #offline-banner,
    html.rr-train-page #rr-cookie-bar,
    html.rr-train-page .rr-cookie,
    html.rr-train-page #loading-screen {
      display: none !important;
    }
    html.rr-train-page #rr-train-page-card .stop-mileage {
      color: #fff !important;
    }''', 1)

# Journey mile class + inherit color so train page can force white
t=t.replace(
    '<br><small style="color:#555; font-size:10px; line-height:1.1;">${mileageInfo}</small>',
    '<br><small class="stop-mileage" style="font-size:10px; line-height:1.1;">${mileageInfo}</small>',
    1,
)

# Stronger train-number shortener used by live and future trains
old_ex='''      function extractTrainNumber(tripId) {
        if (!tripId) return null;
        const parts = tripId.split('-');
        return parts.length > 2 ? parts[2] : null;
      }'''
new_ex='''      function extractTrainNumber(tripId) {
        if (!tripId) return null;
        const raw = String(tripId).trim();
        const parts = raw.split('-').filter(Boolean);
        if (!parts.length) return raw;
        for (let i = parts.length - 1; i >= 0; i--) {
          if (/^\\d+[A-Za-z]?$/.test(parts[i])) return parts[i];
        }
        return parts.length > 2 ? parts[2] : parts[parts.length - 1];
      }'''
if old_ex in t:
    t=t.replace(old_ex, new_ex, 1)
else:
    print('extractTrainNumber block not exact; leaving function')

# Scheduled popup header currently prints full trip id
t=t.replace(
    '<span style="font-weight:700; color:#ffffff; font-style:italic;">${tid}</span>',
    '<span style="font-weight:700; color:#ffffff; font-style:italic;">${(typeof extractTrainNumber===\'function\' && extractTrainNumber(tid)) || tid}</span>',
    1,
)
t=t.replace(
    '<div class="info-item"><span class="info-label">Trip</span><span class="info-value">${tid}</span></div>',
    '<div class="info-item"><span class="info-label">Trip</span><span class="info-value">${(typeof extractTrainNumber===\'function\' && extractTrainNumber(tid)) || tid}</span></div>',
    1,
)

# Shared scheduled page HTML uses page.tid raw in header/value
# Display short number there too if those strings exist.
t=t.replace(
    "String(page.tid || '') + '</span><span style=\"color:#ffffff;font-weight:500;font-style:italic;\"> to </span>",
    "String((typeof extractTrainNumber==='function' && extractTrainNumber(page.tid)) || page.tid || '') + '</span><span style=\"color:#ffffff;font-weight:500;font-style:italic;\"> to </span>",
    1,
)

p.write_text(t, encoding='utf-8')
print('polished share page')
