// Paste into railroadradar-proxy. Records passed-stop actual times even when no one has the site open.
// Add a Cron Trigger of */5 * * * * on this Worker.
// Add a secret named FIREBASE_SERVICE_ACCOUNT with the Firebase service account JSON.
// That account bypasses the rules, so the page does not have to be open.

const PROJECT_ID = 'railroadradar-accounts';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const body = String(pem).replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(body);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function googleAccessToken(env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const jwt = `${header}.${claim}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No access token');
  return data.access_token;
}

function serviceDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}
function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
}
function trainNumber(tripId) {
  const parts = String(tripId || '').split('-').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+[A-Za-z]?$/.test(parts[i])) return parts[i].replace(/^0+(?=\d)/, '');
  }
  return String(tripId || '');
}
function docId(agency, date, number) {
  return [agency, date, String(number).replace(/[^A-Za-z0-9_-]/g, '')].join('_').slice(0, 140);
}
function field(v) {
  if (v == null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(Math.round(v)) };
  return { stringValue: String(v) };
}
function stopFields(s) {
  return {
    mapValue: {
      fields: {
        name: field(s.name || ''),
        stopId: field(s.stopId || ''),
        scheduled: field(s.scheduled || null),
        predicted: field(s.predicted || null),
        actual: field(s.actual || null),
        completed: field(!!s.completed),
        delayMinutes: field(Number(s.delayMinutes) || 0)
      }
    }
  };
}
function readStops(doc) {
  const vals = doc && doc.fields && doc.fields.stops && doc.fields.stops.arrayValue && doc.fields.stops.arrayValue.values;
  if (!vals) return [];
  return vals.map((v) => {
    const f = (v.mapValue && v.mapValue.fields) || {};
    const str = (x) => (x && x.stringValue) || '';
    return {
      name: str(f.name),
      stopId: str(f.stopId),
      scheduled: str(f.scheduled) || null,
      predicted: str(f.predicted) || null,
      actual: str(f.actual) || null,
      completed: !!(f.completed && f.completed.booleanValue),
      delayMinutes: Number(f.delayMinutes && f.delayMinutes.integerValue) || 0
    };
  });
}

async function writeActuals(token, agency, number, date, stops) {
  const id = docId(agency, date, number);
  const expires = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
  const body = {
    fields: {
      agency: field(agency),
      trainNumber: field(String(number)),
      serviceDate: field(date),
      updatedAt: { timestampValue: new Date().toISOString() },
      updatedByUid: field('stop-actuals-worker'),
      expiresAt: { timestampValue: expires },
      stops: { arrayValue: { values: stops.map(stopFields) } }
    }
  };
  const res = await fetch(`${FIRESTORE}/trainStopActuals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) console.warn('[stopActuals] write', agency, number, res.status);
}

async function recordMbta(token, date) {
  const res = await fetch('https://api-v3.mbta.com/predictions?filter[route_type]=2&include=stop&page[limit]=1000');
  if (!res.ok) return;
  const pred = await res.json();
  const names = {};
  (pred.included || []).forEach((inc) => { if (inc.type === 'stop') names[inc.id] = inc.attributes && inc.attributes.name; });
  const byTrip = {};
  const now = Date.now();
  (pred.data || []).forEach((row) => {
    const tripId = row.relationships && row.relationships.trip && row.relationships.trip.data && row.relationships.trip.data.id;
    const stopId = row.relationships && row.relationships.stop && row.relationships.stop.data && row.relationships.stop.data.id;
    const iso = row.attributes && (row.attributes.departure_time || row.attributes.arrival_time);
    if (!tripId || !stopId || !iso || new Date(iso).getTime() > now) return;
    (byTrip[tripId] = byTrip[tripId] || []).push({ stopId: String(stopId), name: names[stopId] || '', actual: clock(iso) });
  });
  for (const tripId of Object.keys(byTrip)) {
    const number = trainNumber(tripId);
    const id = docId('mbta', date, number);
    const existing = await fetch(`${FIRESTORE}/trainStopActuals/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const merged = existing.ok ? readStops(await existing.json()) : [];
    let changed = !existing.ok;
    byTrip[tripId].forEach((p) => {
      const row = merged.find((s) => s.stopId === p.stopId || (p.name && s.name.toLowerCase() === p.name.toLowerCase()));
      if (!row) { merged.push({ name: p.name, stopId: p.stopId, scheduled: null, predicted: p.actual, actual: p.actual, completed: true, delayMinutes: 0 }); changed = true; }
      else if (!row.actual) { row.actual = p.actual; row.completed = true; row.predicted = row.predicted || p.actual; changed = true; }
    });
    if (changed) await writeActuals(token, 'mbta', number, date, merged);
  }
}

async function recordAmtrak(token, date) {
  const res = await fetch('https://api-v3.amtraker.com/v3/trains');
  if (!res.ok) return;
  const data = await res.json();
  const trains = Array.isArray(data) ? data : Object.keys(data).map((k) => data[k]);
  for (const tr of trains) {
    if (!tr || !Array.isArray(tr.stations)) continue;
    const number = tr.trainNum || tr.trainNumRaw;
    if (!number) continue;
    const passed = tr.stations.filter((s) => String(s.status || '').toLowerCase() === 'departed');
    if (!passed.length) continue;
    const id = docId('amtrak', date, number);
    const existing = await fetch(`${FIRESTORE}/trainStopActuals/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const merged = existing.ok ? readStops(await existing.json()) : [];
    let changed = !existing.ok;
    passed.forEach((s) => {
      const name = s.name || s.stationName || s.code || '';
      const iso = s.dep || s.arr;
      const actual = iso ? clock(iso) : null;
      if (!actual) return;
      const row = merged.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
      if (!row) { merged.push({ name, stopId: s.code || '', scheduled: null, predicted: actual, actual, completed: true, delayMinutes: 0 }); changed = true; }
      else if (!row.actual) { row.actual = actual; row.completed = true; changed = true; }
    });
    if (changed) await writeActuals(token, 'amtrak', number, date, merged);
  }
}

async function recordStopActuals(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return;
  const token = await googleAccessToken(env);
  const date = serviceDate();
  await recordMbta(token, date);
  await recordAmtrak(token, date);
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(recordStopActuals(env).catch((e) => console.warn('[stopActuals]', e && e.message)));
  }
};
