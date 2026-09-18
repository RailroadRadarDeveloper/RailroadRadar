#!/usr/bin/env python3
from pathlib import Path

HELPERS = '''    const INTEREST_RAILROADS = [
      { id: 'mbta', label: 'MBTA Commuter Rail' },
      { id: 'amtrak', label: 'Amtrak' },
      { id: 'mnr', label: 'Metro-North' },
      { id: 'lirr', label: 'Long Island Rail Road' },
      { id: 'metra', label: 'Metra' },
      { id: 'njt', label: 'NJ Transit' },
      { id: 'ctrail', label: 'CTrail' },
      { id: 'exploring', label: "I'm just exploring" }
    ];
    function interestRailroadLabel(id) {
      const row = INTEREST_RAILROADS.find(function(r) { return r.id === id; });
      return row ? row.label : String(id || '');
    }
    function formatInterestRailroads(ids) {
      const list = (ids || []).map(interestRailroadLabel).filter(Boolean);
      return list.length ? list.join(', ') : '\u2014';
    }
    function normalizeInterestIds(ids) {
      const allow = {};
      INTEREST_RAILROADS.forEach(function(r) { allow[r.id] = true; });
      const out = [];
      const seen = {};
      (ids || []).forEach(function(id) {
        const k = String(id || '').trim().toLowerCase();
        if (!allow[k] || seen[k]) return;
        seen[k] = true;
        out.push(k);
      });
      return out;
    }
'''

NEEDLE = (
    "    let currentUserSettings = { reportDisplayMode: 'first_initial', "
    "reportCustomLabel: '', interestedRailroads: [], interestedRailroadsSet: false, "
    "reportStats: null, legalAccepted: false, legalVersion: null };\n"
)

builder = Path('scripts/build-admin-page.py')
text = builder.read_text(encoding='utf-8')
if text.strip() == 'PLACEHOLDER':
    raise SystemExit('builder still PLACEHOLDER; restore it first')

old = 'needed = [\n    "const BOOTSTRAP_ADMIN_EMAILS",\n'
new = (
    'needed = [\n'
    '    "const INTEREST_RAILROADS",\n'
    '    "function interestRailroadLabel",\n'
    '    "function formatInterestRailroads",\n'
    '    "function normalizeInterestIds",\n'
    '    "const BOOTSTRAP_ADMIN_EMAILS",\n'
)
if '"function formatInterestRailroads"' not in text:
    if old not in text:
        raise SystemExit('needed list not found in builder')
    builder.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('patched builder')
else:
    print('builder already lists helpers')

admin = Path('admin.html')
src = admin.read_text(encoding='utf-8')
if 'function formatInterestRailroads(ids)' in src:
    print('admin.html already has helpers')
else:
    if NEEDLE not in src:
        raise SystemExit('admin.html insertion point not found')
    admin.write_text(src.replace(NEEDLE, NEEDLE + HELPERS, 1), encoding='utf-8')
    print('patched admin.html')
