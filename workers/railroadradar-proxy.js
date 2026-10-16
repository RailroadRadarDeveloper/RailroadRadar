var METRA_BASE = "https://gtfspublic.metrarr.com/gtfs/public";
var MTA_BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds";
var MBTA_BASE = "https://api-v3.mbta.com";
var MAPBOX_BASE = "https://api.mapbox.com";
var AMTRAK_URL = "https://api-v3.amtraker.com/v3/trains";
var AMTRAK_ALERTS_URL = "https://asm-backend.transitdocs.com/gtfs/amtrak";
var NJT_BASE = "https://raildata.njtransit.com/api/TrainData";
var NJT_TOKEN_CACHE_URL = "https://railroadradar.internal/njt-token";
var NJT_VEHICLES_CACHE_URL = "https://railroadradar.internal/njt-vehicles";
var METRA_ROUTES = {
  "/api/metra/positions": "/positions",
  "/api/metra/tripupdates": "/tripupdates",
  "/api/metra/alerts": "/alerts",
  "/metra/positions": "/positions",
  "/metra/tripupdates": "/tripupdates",
  "/metra/alerts": "/alerts"
};
var MTA_ROUTES = {
  "/api/mta/mnr": "/mnr%2Fgtfs-mnr",
  "/api/mta/lirr": "/lirr%2Fgtfs-lirr",
  // Unified MTA GTFS-RT ServiceAlerts (subway + LIRR + MNR); filter by informed_entity.agency_id client-side
  "/api/mta/alerts": "/camsys%2Fall-alerts",
  "/mta/mnr": "/mnr%2Fgtfs-mnr",
  "/mta/lirr": "/lirr%2Fgtfs-lirr",
  "/mta/alerts": "/camsys%2Fall-alerts"
};
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "*";
  const allow = env.ALLOWED_ORIGIN || "*";
  const acao = allow === "*" ? "*" : origin === allow ? allow : allow;
  const headers = {
    "Access-Control-Allow-Origin": acao,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (acao !== "*")
    headers.Vary = "Origin";
  return headers;
}
async function handleAsk(request, env, cors) {
  const key = env.GROQ_API_KEY;
  if (!key)
    return jsonResponse({ error: "GROQ_API_KEY secret not set" }, 500, cors);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: "Bad JSON" }, 400, cors);
  }
  const question = String(body && body.question || "").trim().slice(0, 400);
  if (question.length < 2)
    return jsonResponse({ error: "Question required" }, 400, cors);
  const context = String(body && body.context || "").trim().slice(0, 8e3).replace(/SERVICE DISRUPTION/gi, "disrupted").replace(/\bPredeparture\b/gi, "not departed yet").replace(/\bCompleted\b/gi, "finished");
  const messages = [
    {
      role: "system",
      content: "You are RailroadRadar. Rewrite the live train facts into a short friendly answer. Use ONLY the provided facts. Do not invent train numbers, lines, destinations, delays, or stops. Do not drop trains that are listed. Keep every train number and status exactly. 1-4 short sentences, or a short list. No headings."
    },
    {
      role: "user",
      content: (context ? "Live trains right now:\n" + context + "\n\n" : "") + "Question: " + question
    }
  ];
  async function callGroq(extra) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        model: "openai/gpt-oss-20b",
        temperature: 0.1,
        max_completion_tokens: 1024,
        messages
      }, extra || {}))
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
    }
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    let answer = String(msg && msg.content || "").trim();
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    return { ok: res.ok, status: res.status, data, answer };
  }
  let first;
  try {
    first = await callGroq({ reasoning_effort: "low", include_reasoning: false });
  } catch (_) {
    first = { ok: false, status: 0, data: {}, answer: "" };
  }
  if (first.ok && first.answer)
    return jsonResponse({ answer: first.answer }, 200, cors);
  let second;
  try {
    second = await callGroq({});
  } catch (_) {
    second = { ok: false, status: 0, data: {}, answer: "" };
  }
  if (second.ok && second.answer)
    return jsonResponse({ answer: second.answer }, 200, cors);
  const hitLimit = first && first.status === 429 || second && second.status === 429;
  return jsonResponse({
    answer: hitLimit ? "Too many questions just now. Wait a couple seconds and try again." : "I could not read the live map just then. Try once more."
  }, 200, cors);
}
function jsonResponse(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
async function proxyBinary(upstreamUrl, headers, cors, cacheTtl) {
  const ttl = cacheTtl || 15;
  const cacheKey = new Request(
    "https://railroadradar.internal/proxy-bin/v2/" + encodeURIComponent(String(upstreamUrl)),
    { method: "GET" }
  );
  try {
    const hit = await caches.default.match(cacheKey);
    if (hit) {
      const body2 = await hit.arrayBuffer();
      return new Response(body2, {
        status: hit.status || 200,
        headers: {
          ...cors,
          "Content-Type": hit.headers.get("Content-Type") || "application/octet-stream",
          "Cache-Control": "public, max-age=" + ttl,
          "X-RR-Proxy-Cache": "HIT"
        }
      });
    }
  } catch (_) {
  }
  const res = await fetch(upstreamUrl, {
    headers,
    // cacheEverything:true is required — many GTFS-RT origins omit cacheable Cache-Control.
    cf: { cacheTtl: ttl, cacheEverything: true }
  });
  const body = await res.arrayBuffer();
  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  if (res.ok && body && body.byteLength > 0) {
    try {
      await caches.default.put(
        cacheKey,
        new Response(body.slice(0), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=" + ttl
          }
        })
      );
    } catch (_) {
    }
  }
  return new Response(body, {
    status: res.status,
    headers: {
      ...cors,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=" + ttl,
      "X-RR-Proxy-Cache": "MISS"
    }
  });
}
async function njtReadCache(url) {
  try {
    const hit = await caches.default.match(new Request(url));
    if (!hit)
      return null;
    const text = await hit.text();
    return text || null;
  } catch (_) {
    return null;
  }
}
async function njtWriteCache(url, body, maxAge) {
  try {
    await caches.default.put(
      new Request(url),
      new Response(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=" + String(maxAge)
        }
      })
    );
  } catch (_) {
  }
}
async function njtDeleteCache(url) {
  try {
    await caches.default.delete(new Request(url));
  } catch (_) {
  }
}
function njtMultipartBody(fields) {
  const boundary = "----RRNjt" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const chunks = [];
  Object.keys(fields || {}).forEach(function(key) {
    const val = fields[key];
    if (val == null || val === "")
      return;
    chunks.push(
      "--" + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"\r\n\r\n' + String(val) + "\r\n"
    );
  });
  chunks.push("--" + boundary + "--\r\n");
  return {
    body: chunks.join(""),
    contentType: "multipart/form-data; boundary=" + boundary
  };
}
async function njtPostMultipart(method, fields) {
  const packed = njtMultipartBody(fields);
  const res = await fetch(NJT_BASE + "/" + method, {
    method: "POST",
    headers: {
      Accept: "text/plain",
      "Content-Type": packed.contentType
    },
    body: packed.body
  });
  const text = await res.text();
  return { status: res.status, text };
}
async function njtGetToken(env) {
  if (env.NJT_TOKEN)
    return String(env.NJT_TOKEN);
  const cached = await njtReadCache(NJT_TOKEN_CACHE_URL);
  if (cached)
    return cached;
  const user = env.NJT_USERNAME;
  const pass = env.NJT_PASSWORD;
  if (!user || !pass)
    throw new Error("NJT_USERNAME/NJT_PASSWORD secrets not set");
  const out = await njtPostMultipart("getToken", { username: user, password: pass });
  let data = null;
  try {
    data = JSON.parse(out.text);
  } catch (_) {
  }
  const token = data && (data.UserToken || data.userToken);
  const authed = data && String(data.Authenticated || data.authenticated || "");
  if (!token || /^(false|0)$/i.test(authed)) {
    const detail = out.text ? out.text.slice(0, 300) : "HTTP " + out.status + " empty body \u2014 check Content-Type (need multipart)";
    throw new Error("NJT getToken failed: " + detail);
  }
  await njtWriteCache(NJT_TOKEN_CACHE_URL, token, 60 * 60 * 12);
  return token;
}
async function njtPostJson(method, extra, env) {
  let token = await njtGetToken(env);
  let fields = Object.assign({ token }, extra || {});
  let out = await njtPostMultipart(method, fields);
  if (/invalid.?token|not authenticated/i.test(out.text) || out.status === 401) {
    await njtDeleteCache(NJT_TOKEN_CACHE_URL);
    token = await njtGetToken(env);
    fields = Object.assign({ token }, extra || {});
    out = await njtPostMultipart(method, fields);
  }
  return { status: out.status, text: out.text };
}
var FIRESTORE_REPORTS = "https://firestore.googleapis.com/v1/projects/railroadradar-accounts/databases/(default)/documents/trainReports?pageSize=300";
var FIRESTORE_KEY = "AIzaSyBCXgIwkKHBrNfs4-0T0L9LQNb6GP-37Qs";
var SPECIAL_ROSTER = [
  ["mbta", "1030"],
  ["mbta", "1036"],
  ["mbta", "1071"],
  ["mbta", "1072"],
  ["mbta", "1128"],
  ["mbta", "1129"],
  ["mbta", "1130"],
  ["mbta", "1776"],
  ["mbta", "1125"],
  ["mbta", "1136"],
  ["mbta", "1137"],
  ["amtrak", "46"],
  ["amtrak", "100"],
  ["amtrak", "108"],
  ["amtrak", "130"],
  ["amtrak", "145"],
  ["amtrak", "160"],
  ["amtrak", "164"],
  ["amtrak", "174"],
  ["amtrak", "301"],
  ["amtrak", "600"],
  ["amtrak", "642"],
  ["amtrak", "90406"],
  ["mnr", "201"],
  ["mnr", "203"],
  ["mnr", "208"],
  ["mnr", "211"],
  ["mnr", "214"],
  ["mnr", "216"],
  ["mnr", "217"],
  ["mnr", "218"],
  ["mnr", "222"],
  ["mnr", "250"],
  ["lirr", "521"]
];
var SPECIAL_IDS = new Set(SPECIAL_ROSTER.map((x) => x[1]));
var SPECIAL_KEYS = new Set(SPECIAL_ROSTER.map((x) => x[0] + "|" + x[1]));
function b64urlToBytes(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4)
    s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++)
    out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++)
    s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concatBytes(parts) {
  let n = 0;
  parts.forEach((p) => {
    n += p.length;
  });
  const out = new Uint8Array(n);
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}
async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}
async function hkdfExpand(prk, info, len) {
  const infoB = typeof info === "string" ? new TextEncoder().encode(info) : info;
  const t = await hmacSha256(prk, concatBytes([infoB, new Uint8Array([1])]));
  return t.slice(0, len);
}
function fsVal(node) {
  if (!node || typeof node !== "object")
    return null;
  if (node.stringValue != null)
    return node.stringValue;
  if (node.integerValue != null)
    return String(node.integerValue);
  if (node.doubleValue != null)
    return String(node.doubleValue);
  if (node.booleanValue != null)
    return node.booleanValue;
  if (node.timestampValue != null)
    return node.timestampValue;
  if (node.arrayValue && Array.isArray(node.arrayValue.values))
    return node.arrayValue.values.map(fsVal);
  if (node.mapValue && node.mapValue.fields) {
    const o = {};
    Object.keys(node.mapValue.fields).forEach((k) => {
      o[k] = fsVal(node.mapValue.fields[k]);
    });
    return o;
  }
  return null;
}
function fsDoc(doc) {
  const fields = doc && doc.fields || {};
  const out = { id: String(doc && doc.name || "").split("/").pop() };
  Object.keys(fields).forEach((k) => {
    out[k] = fsVal(fields[k]);
  });
  return out;
}
function reportLocoIds(r) {
  const ids = [];
  function add(v) {
    const id = String(v == null ? "" : v).trim();
    if (id && ids.indexOf(id) === -1)
      ids.push(id);
  }
  if (Array.isArray(r.locomotives)) {
    r.locomotives.forEach((L) => {
      if (!L)
        return;
      if (typeof L === "object")
        add(L.locomotiveId || L.unitName);
      else
        add(L);
    });
  }
  add(r.locomotiveId);
  add(r.vehicleId);
  if (!ids.length)
    add(r.unitName);
  return ids;
}
function agencyPretty(a) {
  return { mbta: "MBTA", amtrak: "Amtrak", mnr: "Metro-North", lirr: "LIRR", metra: "Metra", njt: "NJ Transit" }[String(a || "").toLowerCase()] || String(a || "").toUpperCase();
}
async function importVapidKey(env) {
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY || "");
  const d = env.VAPID_PRIVATE_KEY || "";
  if (pub.length !== 65 || pub[0] !== 4)
    throw new Error("bad vapid public key");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65))
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
async function vapidJwt(env, audience) {
  const key = await importVapidKey(env);
  const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1e3) + 12 * 3600,
    sub: env.VAPID_SUBJECT || "mailto:turokerr@gmail.com"
  })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(header + "." + payload)));
  return header + "." + payload + "." + bytesToB64url(sig);
}
async function encryptWebPush(subscription, payload) {
  const uaPubRaw = b64urlToBytes(subscription.keys.p256dh);
  const auth = b64urlToBytes(subscription.keys.auth);
  const asPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asPair.publicKey));
  const uaPub = await crypto.subtle.importKey("raw", uaPubRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPub }, asPair.privateKey, 256));
  const prkAuth = await hmacSha256(auth, ecdhBits);
  const info = concatBytes([
    new TextEncoder().encode("WebPush: info\0"),
    uaPubRaw,
    asPubRaw
  ]);
  const ikm = await hkdfExpand(prkAuth, info, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkSalt = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prkSalt, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdfExpand(prkSalt, "Content-Encoding: nonce\0", 12);
  const body = concatBytes([new TextEncoder().encode(payload), new Uint8Array([2])]);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, body));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concatBytes([salt, rs, new Uint8Array([asPubRaw.length]), asPubRaw, cipher]);
}
async function sendWebPush(env, subscription, data) {
  const endpoint = subscription.endpoint;
  const origin = new URL(endpoint).origin;
  const jwt = await vapidJwt(env, origin);
  const body = await encryptWebPush(subscription, JSON.stringify(data));
  const headers = {
    TTL: "86400",
    Urgency: "high",
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    Authorization: "vapid t=" + jwt + ", k=" + env.VAPID_PUBLIC_KEY
  };
  return fetch(endpoint, { method: "POST", headers, body });
}
async function handlePushSubscribe(request, env, cors) {
  if (!env.PUSH_SUBS)
    return jsonResponse({ error: "Push store missing" }, 500, cors);
  const body = await request.json().catch(() => null);
  const sub = body && body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return jsonResponse({ error: "Invalid subscription" }, 400, cors);
  }
  const id = bytesToB64url(new TextEncoder().encode(sub.endpoint)).slice(0, 88);
  const prefs = body.prefs || {};
  await env.PUSH_SUBS.put("sub:" + id, JSON.stringify({
    endpoint: sub.endpoint,
    keys: sub.keys,
    prefs: {
      specialActive: prefs.specialActive !== false,
      specialReport: prefs.specialReport !== false,
      railroads: Array.isArray(prefs.railroads) ? prefs.railroads.map((x) => String(x || "").toLowerCase()).filter(Boolean).slice(0, 12) : [],
      trains: Array.isArray(prefs.trains) ? prefs.trains.map((x) => String(x || "").toLowerCase()).filter(Boolean).slice(0, 80) : []
    },
    updatedAt: Date.now()
  }));
  return jsonResponse({ ok: true }, 200, cors);
}
async function handlePushUnsubscribe(request, env, cors) {
  if (!env.PUSH_SUBS)
    return jsonResponse({ error: "Push store missing" }, 500, cors);
  const body = await request.json().catch(() => null);
  const endpoint = body && body.endpoint;
  if (!endpoint)
    return jsonResponse({ error: "endpoint required" }, 400, cors);
  const id = bytesToB64url(new TextEncoder().encode(endpoint)).slice(0, 88);
  await env.PUSH_SUBS.delete("sub:" + id);
  return jsonResponse({ ok: true }, 200, cors);
}
async function listSubscriptions(env) {
  const out = [];
  if (!env.PUSH_SUBS)
    return out;
  let cursor;
  do {
    const page = await env.PUSH_SUBS.list({ prefix: "sub:", cursor });
    for (const k of page.keys || []) {
      const raw = await env.PUSH_SUBS.get(k.name);
      if (!raw)
        continue;
      try {
        out.push({ id: k.name, sub: JSON.parse(raw) });
      } catch (_) {
      }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}
function notifyPrefsMatchEvent(prefs, event) {
  prefs = prefs || {};
  const rails = Array.isArray(prefs.railroads) ? prefs.railroads : [];
  const trains = Array.isArray(prefs.trains) ? prefs.trains : [];
  const agency = String(event.agency || "").toLowerCase();
  const unitId = String(event.unitId || "").trim();
  if (rails.length && agency && rails.indexOf(agency) === -1)
    return false;
  if (trains.length) {
    const key = (agency + "|" + unitId).toLowerCase();
    const idLower = unitId.toLowerCase();
    let ok = false;
    for (let i = 0; i < trains.length; i++) {
      const t = String(trains[i] || "").toLowerCase();
      if (t === key || t === idLower) {
        ok = true;
        break;
      }
    }
    if (!ok)
      return false;
  }
  return true;
}
function collectExtraWatched(subs) {
  const ids = /* @__PURE__ */ new Set();
  const keys = /* @__PURE__ */ new Set();
  (subs || []).forEach((row) => {
    const trains = row.sub && row.sub.prefs && row.sub.prefs.trains || [];
    trains.forEach((t) => {
      const s = String(t || "").toLowerCase().trim();
      if (!s)
        return;
      if (s.indexOf("|") !== -1) {
        keys.add(s);
        const id = s.split("|").slice(1).join("|");
        if (id)
          ids.add(id);
      } else {
        ids.add(s);
      }
    });
  });
  return { ids, keys };
}
function isWatchedUnit(agency, id, extra) {
  const a = String(agency || "").toLowerCase();
  const raw = String(id == null ? "" : id).trim();
  if (!raw)
    return false;
  if (SPECIAL_IDS.has(raw) || SPECIAL_KEYS.has(a + "|" + raw))
    return true;
  if (!extra)
    return false;
  const idL = raw.toLowerCase();
  return !!(extra.ids.has(idL) || extra.keys.has(a + "|" + idL));
}
async function fanout(env, event) {
  const subs = await listSubscriptions(env);
  const kind = event.type;
  await Promise.all(subs.map(async (row) => {
    const prefs = row.sub && row.sub.prefs || {};
    if (kind === "active" && prefs.specialActive === false)
      return;
    if (kind === "report" && prefs.specialReport === false)
      return;
    if (!notifyPrefsMatchEvent(prefs, event))
      return;
    try {
      const res = await sendWebPush(env, row.sub, event);
      if (res.status === 404 || res.status === 410)
        await env.PUSH_SUBS.delete(row.id);
    } catch (_) {
    }
  }));
}
async function fetchAllReports() {
  const res = await fetch(FIRESTORE_REPORTS + "&key=" + FIRESTORE_KEY);
  if (!res.ok)
    return [];
  const data = await res.json();
  return (data.documents || []).map(fsDoc);
}
function walkIds(obj, out) {
  if (obj == null)
    return;
  if (typeof obj === "string" || typeof obj === "number") {
    const s = String(obj).trim();
    if (s)
      out.add(s);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((x) => walkIds(x, out));
    return;
  }
  if (typeof obj === "object")
    Object.keys(obj).forEach((k) => walkIds(obj[k], out));
}
async function fetchLiveSpecials(env, extra) {
  const live = {};
  extra = extra || { ids: /* @__PURE__ */ new Set(), keys: /* @__PURE__ */ new Set() };
  try {
    const r = await fetch(AMTRAK_URL);
    if (r.ok) {
      const data = await r.json();
      Object.keys(data || {}).forEach((k) => {
        const arr = data[k];
        if (!Array.isArray(arr))
          return;
        arr.forEach((t) => {
          const ids = /* @__PURE__ */ new Set();
          walkIds(t && (t.vehicles || t.engine || t.locos || t.locomotives), ids);
          ids.forEach((id) => {
            if (!isWatchedUnit("amtrak", id, extra))
              return;
            const train = t.trainNum || t.trainNumRaw || k;
            live["live|amtrak|" + id + "|" + train] = {
              type: "active",
              title: id + " is live",
              body: "Amtrak train " + train,
              tag: "live|amtrak|" + id + "|" + train,
              agency: "amtrak",
              unitId: id
            };
          });
        });
      });
    }
  } catch (_) {
  }
  try {
    const r = await fetch(MBTA_BASE + "/vehicles?filter[route_type]=2", {
      headers: env.MBTA_API_KEY ? { "x-api-key": env.MBTA_API_KEY } : {}
    });
    if (r.ok) {
      const data = await r.json();
      (data.data || []).forEach((v) => {
        const id = String(v && v.id || "").trim();
        if (!id)
          return;
        if (!isWatchedUnit("mbta", id, extra))
          return;
        const label = v.attributes && (v.attributes.label || v.attributes.current_status) || id;
        live["live|mbta|" + id] = {
          type: "active",
          title: id + " is live",
          body: "MBTA " + label,
          tag: "live|mbta|" + id,
          agency: "mbta",
          unitId: id
        };
      });
    }
  } catch (_) {
  }
  return live;
}
async function scanAndNotify(env) {
  if (!env.PUSH_SUBS || !env.VAPID_PRIVATE_KEY)
    return;
  const subs = await listSubscriptions(env);
  const extra = collectExtraWatched(subs);
  const prev = JSON.parse(await env.PUSH_SUBS.get("notify:state") || '{"reports":{},"live":{}}');
  const reports = await fetchAllReports().catch(() => []);
  const reportEvents = {};
  reports.forEach((r) => {
    const agency = String(r.agency || "").toLowerCase();
    const locos = reportLocoIds(r);
    locos.forEach((id) => {
      if (!isWatchedUnit(agency, id, extra))
        return;
      const k = "rep|" + r.id + "|" + id;
      reportEvents[k] = {
        type: "report",
        title: "New report: " + (r.unitName || id),
        body: (agencyPretty(r.agency) + (r.trainNumber ? " train " + r.trainNumber : "") + (r.reportedByLabel ? " \xB7 " + r.reportedByLabel : "")).trim(),
        tag: k,
        agency,
        unitId: id
      };
    });
  });
  const liveEvents = await fetchLiveSpecials(env, extra).catch(() => ({}));
  const fresh = [];
  Object.keys(reportEvents).forEach((k) => {
    if (!prev.reports[k])
      fresh.push(reportEvents[k]);
  });
  Object.keys(liveEvents).forEach((k) => {
    if (!prev.live[k])
      fresh.push(liveEvents[k]);
  });
  const seeded = !Object.keys(prev.reports || {}).length && !Object.keys(prev.live || {}).length;
  await env.PUSH_SUBS.put("notify:state", JSON.stringify({ reports: reportEvents, live: liveEvents, at: Date.now() }));
  if (seeded)
    return;
  for (const evt of fresh.slice(0, 12)) {
    await fanout(env, evt);
  }
}
var GTFS_ZIP_URLS = {
  amtrak: "https://content.amtrak.com/content/gtfs/GTFS.zip",
  mnr: "https://rrgtfsfeeds.s3.amazonaws.com/gtfsmnr.zip",
  lirr: "https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip",
  njt: "https://content.njtransit.com/sites/default/files/developers-resources/rail_data.zip",
  // CTrail Hartford Line trains appear in Amtrak GTFS; filtered by route name below
  ctrail: "https://content.amtrak.com/content/gtfs/GTFS.zip"
};
var GTFS_CACHE_TTL_SEC = 6 * 60 * 60;
var MBTA_CR_ROUTES = [
  "CR-Fairmount",
  "CR-NewBedford",
  "CR-Fitchburg",
  "CR-Worcester",
  "CR-Franklin",
  "CR-Greenbush",
  "CR-Haverhill",
  "CR-Kingston",
  "CR-Lowell",
  "CR-Needham",
  "CR-Newburyport",
  "CR-Providence",
  "CR-Foxboro"
];
function schedulesCacheUrl(kind, agency, date) {
  return "https://railroadradar.internal/schedules-v1/" + kind + "/" + agency + (date ? "/" + date : "");
}
async function cacheGetText(url) {
  try {
    const hit = await caches.default.match(new Request(url));
    if (!hit)
      return null;
    return await hit.text();
  } catch (_) {
    return null;
  }
}
async function cachePutText(url, body, maxAge, contentType) {
  try {
    await caches.default.put(
      new Request(url),
      new Response(body, {
        headers: {
          "Content-Type": contentType || "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=" + String(maxAge || GTFS_CACHE_TTL_SEC)
        }
      })
    );
  } catch (_) {
  }
}
async function cacheGetBuf(url) {
  try {
    const hit = await caches.default.match(new Request(url));
    if (!hit)
      return null;
    return await hit.arrayBuffer();
  } catch (_) {
    return null;
  }
}
async function cachePutBuf(url, buf, maxAge) {
  try {
    await caches.default.put(
      new Request(url),
      new Response(buf, {
        headers: {
          "Content-Type": "application/zip",
          "Cache-Control": "public, max-age=" + String(maxAge || GTFS_CACHE_TTL_SEC)
        }
      })
    );
  } catch (_) {
  }
}
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const n = text.length;
  let row = [];
  let field = "";
  let inQ = false;
  while (i < n) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n")
        i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row.length === 1 && row[0] !== "")
        rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length)
    return [];
  const headers = rows[0].map(function(h) {
    return String(h || "").trim().replace(/^\uFEFF/, "");
  });
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    const cells = rows[r];
    for (let c = 0; c < headers.length; c++)
      obj[headers[c]] = cells[c] != null ? String(cells[c]) : "";
    out.push(obj);
  }
  return out;
}
function u16(view, off) {
  return view.getUint16(off, true);
}
function u32(view, off) {
  return view.getUint32(off, true);
}
async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not available");
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzipNamedFiles(zipBuf, wantedNames) {
  const buf = zipBuf instanceof ArrayBuffer ? zipBuf : zipBuf.buffer;
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 80 && bytes[i + 1] === 75 && bytes[i + 2] === 5 && bytes[i + 3] === 6) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    throw new Error("ZIP EOCD not found");
  const totalEntries = u16(view, eocd + 10);
  const cdOffset = u32(view, eocd + 16);
  const want = {};
  wantedNames.forEach(function(n) {
    want[n.toLowerCase()] = n;
  });
  const found = {};
  let off = cdOffset;
  for (let e = 0; e < totalEntries; e++) {
    if (u32(view, off) !== 33639248)
      break;
    const method = u16(view, off + 10);
    const compSize = u32(view, off + 20);
    const nameLen = u16(view, off + 28);
    const extraLen = u16(view, off + 30);
    const commentLen = u16(view, off + 32);
    const localOff = u32(view, off + 42);
    const nameBytes = bytes.subarray(off + 46, off + 46 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes).replace(/^.*\//, "");
    const key = name.toLowerCase();
    if (want[key]) {
      if (u32(view, localOff) !== 67324752)
        throw new Error("Bad local header for " + name);
      const lNameLen = u16(view, localOff + 26);
      const lExtraLen = u16(view, localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      let raw;
      if (method === 0)
        raw = comp;
      else if (method === 8)
        raw = await inflateRaw(comp);
      else
        throw new Error("Unsupported ZIP method " + method + " for " + name);
      found[want[key]] = new TextDecoder("utf-8").decode(raw);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return found;
}
function ymdToDateParts(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m)
    return null;
  return { y: +m[1], mo: +m[2], d: +m[3], compact: m[1] + m[2] + m[3] };
}
function weekdayField(ymd) {
  const p = ymdToDateParts(ymd);
  if (!p)
    return null;
  const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0));
  const wd = dt.getUTCDay();
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][wd];
}
function serviceIdsForDate(calendarRows, calendarDateRows, ymd) {
  const p = ymdToDateParts(ymd);
  if (!p)
    return /* @__PURE__ */ new Set();
  const compact = p.compact;
  const dayField = weekdayField(ymd);
  const active = /* @__PURE__ */ new Set();
  (calendarRows || []).forEach(function(row) {
    const start = String(row.start_date || "").replace(/-/g, "");
    const end = String(row.end_date || "").replace(/-/g, "");
    if (!start || !end)
      return;
    if (compact < start || compact > end)
      return;
    if (String(row[dayField] || "") === "1")
      active.add(String(row.service_id));
  });
  (calendarDateRows || []).forEach(function(row) {
    const d = String(row.date || "").replace(/-/g, "");
    if (d !== compact)
      return;
    const sid = String(row.service_id || "");
    if (!sid)
      return;
    if (String(row.exception_type) === "1")
      active.add(sid);
    else if (String(row.exception_type) === "2")
      active.delete(sid);
  });
  return active;
}
function naturalTrainSort(a, b) {
  return String(a.trainNumber || "").localeCompare(String(b.trainNumber || ""), void 0, {
    numeric: true,
    sensitivity: "base"
  });
}
function trainsFromGtfsFiles(files, agency, ymd) {
  const trips = parseCsv(files["trips.txt"] || "");
  const routes = parseCsv(files["routes.txt"] || "");
  const calendar = parseCsv(files["calendar.txt"] || "");
  const calDates = parseCsv(files["calendar_dates.txt"] || "");
  const routeById = {};
  routes.forEach(function(r) {
    routeById[String(r.route_id)] = r;
  });
  const services = serviceIdsForDate(calendar, calDates, ymd);
  const byNum = {};
  trips.forEach(function(t) {
    if (!services.has(String(t.service_id)))
      return;
    const route = routeById[String(t.route_id)] || {};
    if (agency === "ctrail") {
      const blob = [
        route.route_long_name,
        route.route_short_name,
        route.route_id,
        t.trip_headsign,
        t.trip_short_name
      ].join(" ").toLowerCase();
      if (!/hartford|ct ?rail|valley\s*flyer/.test(blob))
        return;
    }
    const num = String(t.trip_short_name || "").trim() || String(t.trip_id || "").trim();
    if (!num)
      return;
    if (byNum[num])
      return;
    const name = String(route.route_long_name || "").trim() || String(route.route_short_name || "").trim() || "";
    const dest = String(t.trip_headsign || "").trim() || "";
    byNum[num] = { trainNumber: num, name, dest };
  });
  return Object.keys(byNum).map(function(k) {
    return byNum[k];
  }).sort(naturalTrainSort);
}
async function fetchGtfsZip(agency) {
  const cacheAgency = agency === "ctrail" ? "amtrak" : agency;
  const url = GTFS_ZIP_URLS[agency] || GTFS_ZIP_URLS[cacheAgency];
  if (!url)
    throw new Error("No GTFS URL for agency " + agency);
  const cacheKey = schedulesCacheUrl("zip", cacheAgency, "");
  const cached = await cacheGetBuf(cacheKey);
  if (cached)
    return cached;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok)
    throw new Error("GTFS fetch failed " + agency + " HTTP " + res.status);
  const buf = await res.arrayBuffer();
  await cachePutBuf(cacheKey, buf, GTFS_CACHE_TTL_SEC);
  return buf;
}
async function schedulesFromStaticGtfs(agency, ymd) {
  const zipAgency = agency === "ctrail" ? "ctrail" : agency;
  const buf = await fetchGtfsZip(zipAgency);
  const files = await unzipNamedFiles(buf, ["trips.txt", "routes.txt", "calendar.txt", "calendar_dates.txt"]);
  if (!files["trips.txt"])
    throw new Error("trips.txt missing in GTFS for " + agency);
  return trainsFromGtfsFiles(files, agency, ymd);
}
function extractMbtaTrainNumber(tripId) {
  if (!tripId)
    return "";
  const parts = String(tripId).split("-");
  return parts.length > 2 ? parts[2] : String(tripId);
}
async function schedulesFromMbta(env, ymd) {
  const key = env.MBTA_API_KEY;
  if (!key)
    throw new Error("MBTA_API_KEY secret not set");
  const byNum = {};
  const CONCURRENCY = 4;
  async function oneRoute(rid) {
    const upstream = MBTA_BASE + "/schedules?filter[date]=" + encodeURIComponent(ymd) + "&filter[route]=" + encodeURIComponent(rid) + "&include=trip,route";
    const res = await fetch(upstream, { headers: { "x-api-key": key } });
    if (!res.ok)
      return;
    const data = await res.json();
    const included = data.included || [];
    const tripById = {};
    const routeById = {};
    included.forEach(function(inc) {
      if (inc.type === "trip")
        tripById[inc.id] = inc;
      if (inc.type === "route")
        routeById[inc.id] = inc;
    });
    (data.data || []).forEach(function(s) {
      const tid = s.relationships && s.relationships.trip && s.relationships.trip.data && s.relationships.trip.data.id;
      if (!tid)
        return;
      const num = extractMbtaTrainNumber(tid);
      if (!num || byNum[num])
        return;
      const trip = tripById[tid];
      const rid2 = s.relationships && s.relationships.route && s.relationships.route.data && s.relationships.route.data.id || trip && trip.relationships && trip.relationships.route && trip.relationships.route.data && trip.relationships.route.data.id || rid;
      const route = routeById[rid2];
      const name = route && route.attributes && (route.attributes.long_name || route.attributes.short_name) || rid2 || "MBTA";
      const dest = trip && trip.attributes && (trip.attributes.headsign || trip.attributes.name) || "";
      byNum[num] = { trainNumber: num, name: String(name), dest: String(dest || "") };
    });
  }
  for (let i = 0; i < MBTA_CR_ROUTES.length; i += CONCURRENCY) {
    const batch = MBTA_CR_ROUTES.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(function(rid) {
        return oneRoute(rid).catch(function() {
        });
      })
    );
  }
  return Object.keys(byNum).map(function(k) {
    return byNum[k];
  }).sort(naturalTrainSort);
}
async function handleSchedules(request, env, cors) {
  const url = new URL(request.url);
  const agency = String(url.searchParams.get("agency") || "").toLowerCase().trim();
  const date = String(url.searchParams.get("date") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ error: "date=YYYY-MM-DD required" }, 400, cors);
  }
  const allowed = { amtrak: 1, mnr: 1, lirr: 1, mbta: 1, njt: 1, ctrail: 1 };
  if (!allowed[agency]) {
    return jsonResponse({ error: "Unsupported agency. Use amtrak|mnr|lirr|mbta|njt|ctrail" }, 400, cors);
  }
  const resultKey = schedulesCacheUrl("json", agency, date);
  const cached = await cacheGetText(resultKey);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-RR-Schedules-Cache": "HIT"
      }
    });
  }
  let trains;
  if (agency === "mbta")
    trains = await schedulesFromMbta(env, date);
  else
    trains = await schedulesFromStaticGtfs(agency, date);
  const body = JSON.stringify(trains);
  await cachePutText(resultKey, body, GTFS_CACHE_TTL_SEC, "application/json; charset=utf-8");
  return new Response(body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-RR-Schedules-Cache": "MISS"
    }
  });
}
async function warmLiveCaches(env) {
  const cors = { "Access-Control-Allow-Origin": "*" };
  const jobs = [];
  jobs.push(proxyBinary(AMTRAK_URL, {}, cors, 30));
  jobs.push(proxyBinary(AMTRAK_ALERTS_URL, {}, cors, 20));
  {
    const h = {};
    if (env.MTA_API_KEY)
      h["x-api-key"] = env.MTA_API_KEY;
    if (MTA_ROUTES["/api/mta/mnr"])
      jobs.push(proxyBinary(MTA_BASE + MTA_ROUTES["/api/mta/mnr"], h, cors, 15));
    if (MTA_ROUTES["/api/mta/lirr"])
      jobs.push(proxyBinary(MTA_BASE + MTA_ROUTES["/api/mta/lirr"], h, cors, 15));
  }
  if (env.METRA_API_TOKEN) {
    const auth = { Authorization: "Bearer " + env.METRA_API_TOKEN };
    if (METRA_ROUTES["/api/metra/positions"]) {
      jobs.push(proxyBinary(METRA_BASE + METRA_ROUTES["/api/metra/positions"], auth, cors, 15));
    }
    if (METRA_ROUTES["/api/metra/tripupdates"]) {
      jobs.push(proxyBinary(METRA_BASE + METRA_ROUTES["/api/metra/tripupdates"], auth, cors, 15));
    }
  }
  if (env.MBTA_API_KEY) {
    jobs.push(
      proxyBinary(
        MBTA_BASE + "/vehicles?filter[route_type]=2&include=trip,route,stop",
        { "x-api-key": env.MBTA_API_KEY },
        cors,
        15
      )
    );
  }
  await Promise.allSettled(jobs);
}
var PROJECT_ID = "railroadradar-accounts";
var BOOTSTRAP_ADMIN_EMAILS = ["turokerr@gmail.com", "railroadradar@gmail.com"];
var FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
var GOOGLE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var PRESS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};
function b64urlBytes(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
// Returns the token's claims if it is a valid Firebase ID token for this project, else null.
async function verifyFirebaseIdToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3)
    return null;
  const [h, p, sig] = parts;
  const header = JSON.parse(new TextDecoder().decode(b64urlBytes(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlBytes(p)));
  const now = Date.now() / 1e3;
  if (header.alg !== "RS256" || claims.aud !== PROJECT_ID || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}` || !claims.sub || claims.exp < now || claims.iat > now + 300)
    return null;
  const { keys } = await (await fetch(GOOGLE_JWKS, { cf: { cacheTtl: 3600 } })).json();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk)
    return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  return ok ? claims : null;
}
async function isPressAdmin(token, claims) {
  const email = String(claims.email || "").toLowerCase();
  if (!email || claims.email_verified !== true)
    return false;
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email))
    return true;
  // Firestore rules let a signed-in user read their own admins/{email} doc.
  const r = await fetch(`${FIRESTORE}/admins/${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok;
}
async function handlePressNotify(request, env) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: PRESS_CORS });
  const reply = (status, msg) => new Response(msg, { status, headers: PRESS_CORS });
  if (request.method !== "POST")
    return reply(405, "POST only");
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const claims = await verifyFirebaseIdToken(token).catch(() => null);
  if (!claims)
    return reply(401, "Sign in again");
  if (!await isPressAdmin(token, claims))
    return reply(403, "Admins only");
  const { slug } = await request.json().catch(() => ({}));
  if (!slug || typeof slug !== "string")
    return reply(400, "Missing slug");
  const doc = await fetch(`${FIRESTORE}/pressReleases/${encodeURIComponent(slug)}`);
  if (!doc.ok)
    return reply(404, "No such press release");
  const f = (await doc.json()).fields || {};
  const title = String(f.title?.stringValue || "Press release").slice(0, 256);
  const body = String(f.body?.stringValue || "").trim();
  const image = f.images?.arrayValue?.values?.[0]?.mapValue?.fields?.url?.stringValue;
  const url = `https://railroadradar.com/press/index.html?id=${encodeURIComponent(slug)}`;
  // Discord caps an embed description at 4096 characters and a message at 10 embeds.
  const chunks = [];
  for (let i = 0; i < body.length && chunks.length < 10; i += 4096)
    chunks.push(body.slice(i, i + 4096));
  if (!chunks.length)
    chunks.push("");
  const embeds = chunks.map((description, i) => ({
    title: i ? `${title} (cont.)`.slice(0, 256) : title,
    url,
    description,
    color: 706304,
    footer: { text: "RailroadRadar Press" },
    timestamp: new Date().toISOString()
  }));
  if (image)
    embeds[0].image = { url: image };
  const sent = await fetch(env.DISCORD_PRESS_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "RailroadRadar", embeds })
  });
  return reply(sent.ok ? 204 : 502, sent.ok ? null : "Discord rejected the post");
}
// Stop actuals: writes passed-stop times with a service account, so they are recorded with the site closed.
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
  // MBTA refuses filter[route_type] on its own.
  const res = await fetch('https://api-v3.mbta.com/predictions?filter[route]=' + MBTA_CR_ROUTES.join(',') + '&include=stop&page[limit]=1000');
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
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = corsHeaders(request, env);
    // Before the shared OPTIONS reply, whose CORS headers don't allow the Authorization header this route needs.
    if (path === "/api/press/notify")
      return handlePressNotify(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === "POST" && (path === "/api/ask" || path === "/ask")) {
      try {
        return await handleAsk(request, env, cors);
      } catch (err) {
        return jsonResponse({ error: "Ask failed" }, 500, cors);
      }
    }
    if (request.method === "POST" && (path === "/api/push/subscribe" || path === "/push/subscribe")) {
      try {
        return await handlePushSubscribe(request, env, cors);
      } catch (err) {
        return jsonResponse({ error: "Subscribe failed" }, 500, cors);
      }
    }
    if (request.method === "POST" && (path === "/api/push/unsubscribe" || path === "/push/unsubscribe")) {
      try {
        return await handlePushUnsubscribe(request, env, cors);
      } catch (err) {
        return jsonResponse({ error: "Unsubscribe failed" }, 500, cors);
      }
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }
    if (path === "/health" || path === "/") {
      return jsonResponse(
        {
          ok: true,
          service: "railroadradar-proxy",
          routes: [
            "/health",
            "/api/mbta/*",
            "/api/mta/mnr",
            "/api/mta/lirr",
            "/api/mta/alerts",
            "/api/metra/positions|tripupdates|alerts",
            "/api/mapbox/*",
            "/api/amtrak/trains",
            "/api/amtrak/alerts",
            "/api/ask",
            "/api/press/notify",
            "/api/push/vapid",
            "/api/push/subscribe",
            "/api/njt/vehicles",
            "/api/njt/stops",
            "/api/njt/alerts",
            "/api/schedules?agency=&date="
          ]
        },
        200,
        cors
      );
    }
    try {
      if (METRA_ROUTES[path]) {
        const token = env.METRA_API_TOKEN;
        if (!token) {
          return new Response("METRA_API_TOKEN secret not set", { status: 500, headers: cors });
        }
        return await proxyBinary(
          METRA_BASE + METRA_ROUTES[path],
          { Authorization: "Bearer " + token },
          cors,
          15
        );
      }
      if (MTA_ROUTES[path]) {
        const headers = {};
        if (env.MTA_API_KEY)
          headers["x-api-key"] = env.MTA_API_KEY;
        return await proxyBinary(MTA_BASE + MTA_ROUTES[path], headers, cors, 15);
      }
      if (path === "/api/push/vapid" || path === "/push/vapid") {
        if (!env.VAPID_PUBLIC_KEY)
          return jsonResponse({ error: "Push is not configured" }, 503, cors);
        return jsonResponse({ publicKey: env.VAPID_PUBLIC_KEY }, 200, cors);
      }
      if (path === "/api/amtrak/trains" || path === "/amtrak/trains") {
        return await proxyBinary(AMTRAK_URL, {}, cors, 30);
      }
      if (path === "/api/amtrak/alerts" || path === "/amtrak/alerts") {
        return await proxyBinary(AMTRAK_ALERTS_URL, {}, cors, 20);
      }
      if (path === "/api/mbta" || path.startsWith("/api/mbta/")) {
        const key = env.MBTA_API_KEY;
        if (!key) {
          return new Response("MBTA_API_KEY secret not set", { status: 500, headers: cors });
        }
        const rest = path === "/api/mbta" ? "/" : path.slice("/api/mbta".length);
        const upstream = new URL(MBTA_BASE + rest);
        url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
        return await proxyBinary(upstream.toString(), { "x-api-key": key }, cors, 15);
      }
      if (path === "/api/mapbox" || path.startsWith("/api/mapbox/")) {
        const token = env.MAPBOX_TOKEN;
        if (!token) {
          return new Response("MAPBOX_TOKEN secret not set", { status: 500, headers: cors });
        }
        const rest = path === "/api/mapbox" ? "/" : path.slice("/api/mapbox".length);
        const upstream = new URL(MAPBOX_BASE + rest);
        url.searchParams.forEach((v, k) => {
          if (k !== "access_token")
            upstream.searchParams.set(k, v);
        });
        upstream.searchParams.set("access_token", token);
        const res = await fetch(upstream.toString(), {
          cf: { cacheTtl: 3600, cacheEverything: true }
        });
        if (!res.ok) {
          const errText = await res.text();
          const statusLine = `Mapbox upstream ${res.status}${res.statusText ? " " + res.statusText : ""}`;
          return new Response(
            statusLine + ": " + errText.slice(0, 500),
            {
              status: res.status,
              headers: {
                ...cors,
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store"
              }
            }
          );
        }
        const body = await res.arrayBuffer();
        return new Response(body, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": res.headers.get("Content-Type") || "image/png",
            "Cache-Control": "public, max-age=3600, s-maxage=3600"
          }
        });
      }
      if (path === "/api/njt/vehicles" || path === "/njt/vehicles") {
        const cached = await njtReadCache(NJT_VEHICLES_CACHE_URL);
        if (cached) {
          return new Response(cached, {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" }
          });
        }
        const out = await njtPostJson("getVehicleData", {}, env);
        if (out.status >= 400 || /errorMessage/i.test(out.text)) {
          return new Response("Upstream error: " + out.text.slice(0, 400), {
            status: 502,
            headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
          });
        }
        await njtWriteCache(NJT_VEHICLES_CACHE_URL, out.text, 20);
        return new Response(out.text, {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" }
        });
      }
      if (path === "/api/njt/stops" || path === "/njt/stops") {
        const train = url.searchParams.get("train") || url.searchParams.get("id") || "";
        if (!train)
          return jsonResponse({ error: "train query required" }, 400, cors);
        const out = await njtPostJson("getTrainStopList", { train }, env);
        return new Response(out.text, {
          status: out.status >= 400 ? 502 : 200,
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" }
        });
      }
      if (path === "/api/njt/alerts" || path === "/njt/alerts") {
        const out = await njtPostJson("getStationMSG", {}, env);
        return new Response(out.text, {
          status: out.status >= 400 ? 502 : 200,
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }
        });
      }
      if (path === "/api/schedules" || path === "/schedules") {
        try {
          return await handleSchedules(request, env, cors);
        } catch (err) {
          return jsonResponse(
            { error: "Schedules failed", detail: err && err.message ? err.message : String(err) },
            502,
            cors
          );
        }
      }
      return new Response(
        "Not found. Try /health, /api/mbta/*, /api/mta/mnr, /api/mta/lirr, /api/mta/alerts, /api/metra/*, /api/mapbox/*, /api/amtrak/trains, /api/amtrak/alerts, /api/njt/*, /api/schedules",
        { status: 404, headers: cors }
      );
    } catch (err) {
      return new Response(
        "Upstream error: " + (err && err.message ? err.message : String(err)),
        { status: 502, headers: cors }
      );
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await warmLiveCaches(env);
      } catch (_) {
      }
      try {
        await scanAndNotify(env);
      } catch (_) {
      }
      if (new Date(event.scheduledTime).getUTCMinutes() % 5 === 0) {
        try {
          await recordStopActuals(env);
        } catch (e) {
          console.warn("[stopActuals]", e && e.message);
        }
      }
    })());
  }
};
export {
  worker_default as default
};
