var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (acao !== "*")
    headers.Vary = "Origin";
  return headers;
}
__name(corsHeaders, "corsHeaders");
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
  __name(callGroq, "callGroq");
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
__name(handleAsk, "handleAsk");
function jsonResponse(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
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
__name(proxyBinary, "proxyBinary");
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
__name(njtReadCache, "njtReadCache");
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
__name(njtWriteCache, "njtWriteCache");
async function njtDeleteCache(url) {
  try {
    await caches.default.delete(new Request(url));
  } catch (_) {
  }
}
__name(njtDeleteCache, "njtDeleteCache");
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
__name(njtMultipartBody, "njtMultipartBody");
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
__name(njtPostMultipart, "njtPostMultipart");
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
__name(njtGetToken, "njtGetToken");
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
__name(njtPostJson, "njtPostJson");
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
__name(b64urlToBytes, "b64urlToBytes");
function bytesToB64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++)
    s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(bytesToB64url, "bytesToB64url");
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
__name(concatBytes, "concatBytes");
async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}
__name(hmacSha256, "hmacSha256");
async function hkdfExpand(prk, info, len) {
  const infoB = typeof info === "string" ? new TextEncoder().encode(info) : info;
  const t = await hmacSha256(prk, concatBytes([infoB, new Uint8Array([1])]));
  return t.slice(0, len);
}
__name(hkdfExpand, "hkdfExpand");
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
__name(fsVal, "fsVal");
function fsDoc(doc) {
  const fields = doc && doc.fields || {};
  const out = { id: String(doc && doc.name || "").split("/").pop() };
  Object.keys(fields).forEach((k) => {
    out[k] = fsVal(fields[k]);
  });
  return out;
}
__name(fsDoc, "fsDoc");
function reportLocoIds(r) {
  const ids = [];
  function add(v) {
    const id = String(v == null ? "" : v).trim();
    if (id && ids.indexOf(id) === -1)
      ids.push(id);
  }
  __name(add, "add");
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
__name(reportLocoIds, "reportLocoIds");
function agencyPretty(a) {
  return { mbta: "MBTA", amtrak: "Amtrak", mnr: "Metro-North", lirr: "LIRR", metra: "Metra", njt: "NJ Transit" }[String(a || "").toLowerCase()] || String(a || "").toUpperCase();
}
__name(agencyPretty, "agencyPretty");
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
__name(importVapidKey, "importVapidKey");
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
__name(vapidJwt, "vapidJwt");
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
__name(encryptWebPush, "encryptWebPush");
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
__name(sendWebPush, "sendWebPush");
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
  const rec = {
    endpoint: sub.endpoint,
    keys: sub.keys,
    prefs: {
      specialActive: prefs.specialActive !== false,
      specialReport: prefs.specialReport !== false,
      railroads: Array.isArray(prefs.railroads) ? prefs.railroads.map((x) => String(x || "").toLowerCase()).filter(Boolean).slice(0, 12) : [],
      trains: Array.isArray(prefs.trains) ? prefs.trains.map((x) => String(x || "").toLowerCase()).filter(Boolean).slice(0, 80) : []
    },
    updatedAt: Date.now()
  };
  const index = await subsIndexLoad(env);
  const key = "sub:" + id;
  const prev = index.subs[key];
  if (prev && subsSameRecord(prev, rec))
    return jsonResponse({ ok: true }, 200, cors);
  const wasEmpty = !Object.keys(index.subs).length;
  await env.PUSH_SUBS.put(key, JSON.stringify(rec));
  index.subs[key] = rec;
  await subsIndexSave(env, index);
  // The special-move scan is skipped while nobody is subscribed, so its saved state is stale; drop it so the next run re-seeds instead of sending a backlog.
  if (wasEmpty)
    await env.PUSH_SUBS.delete("notify:state").catch(() => {});
  return jsonResponse({ ok: true }, 200, cors);
}
__name(handlePushSubscribe, "handlePushSubscribe");
async function handlePushUnsubscribe(request, env, cors) {
  if (!env.PUSH_SUBS)
    return jsonResponse({ error: "Push store missing" }, 500, cors);
  const body = await request.json().catch(() => null);
  const endpoint = body && body.endpoint;
  if (!endpoint)
    return jsonResponse({ error: "endpoint required" }, 400, cors);
  const id = bytesToB64url(new TextEncoder().encode(endpoint)).slice(0, 88);
  await env.PUSH_SUBS.delete("sub:" + id);
  const index = await subsIndexLoad(env);
  if (index.subs["sub:" + id]) {
    delete index.subs["sub:" + id];
    await subsIndexSave(env, index);
  }
  return jsonResponse({ ok: true }, 200, cors);
}
__name(handlePushUnsubscribe, "handlePushUnsubscribe");
// Special-move push subscriptions. "sub:<id>" keys stay the source of truth, but the cron reads one
// "subs:index" key ({ builtAt, subs: { "sub:<id>": record } }) instead of list() + a get per key every run
// (free-plan KV allows 1,000 list ops/day; the cron runs 720x/day). The index is rebuilt with list() only
// when it is missing or older than SUBS_INDEX_REBUILD_MS, so at most about once a day.
var SUBS_INDEX_KEY = "subs:index";
var SUBS_INDEX_REBUILD_MS = 24 * 60 * 60 * 1e3;
function subsSameRecord(a, b) {
  return JSON.stringify({ e: a.endpoint, k: a.keys, p: a.prefs }) === JSON.stringify({ e: b.endpoint, k: b.keys, p: b.prefs });
}
__name(subsSameRecord, "subsSameRecord");
async function subsIndexSave(env, index) {
  await env.PUSH_SUBS.put(SUBS_INDEX_KEY, JSON.stringify({ builtAt: index.builtAt || Date.now(), subs: index.subs || {} }));
}
__name(subsIndexSave, "subsIndexSave");
async function subsIndexRebuild(env, prevIndex) {
  const subs = {};
  for (const row of await listSubscriptionsFromKeys(env))
    subs[row.id] = row.sub;
  const index = { builtAt: Date.now(), subs };
  // One write per rebuild (needed to record builtAt); rebuilds happen about once a day.
  await subsIndexSave(env, index);
  return index;
}
__name(subsIndexRebuild, "subsIndexRebuild");
async function subsIndexLoad(env) {
  let index = null;
  try {
    index = JSON.parse(await env.PUSH_SUBS.get(SUBS_INDEX_KEY) || "null");
  } catch (_) {
    index = null;
  }
  if (!index || typeof index !== "object" || !index.subs || typeof index.subs !== "object" || !(Date.now() - Number(index.builtAt || 0) < SUBS_INDEX_REBUILD_MS)) {
    index = await subsIndexRebuild(env, index);
  }
  return index;
}
__name(subsIndexLoad, "subsIndexLoad");
async function listSubscriptions(env) {
  if (!env.PUSH_SUBS)
    return [];
  const index = await subsIndexLoad(env);
  return Object.keys(index.subs).map((id) => ({ id, sub: index.subs[id] })).filter((row) => row.sub && row.sub.endpoint);
}
__name(listSubscriptions, "listSubscriptions");
async function subsIndexRemove(env, ids) {
  if (!ids || !ids.length)
    return;
  const index = await subsIndexLoad(env);
  let changed = false;
  ids.forEach((id) => {
    if (index.subs[id]) {
      delete index.subs[id];
      changed = true;
    }
  });
  if (changed)
    await subsIndexSave(env, index);
}
__name(subsIndexRemove, "subsIndexRemove");
async function listSubscriptionsFromKeys(env) {
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
__name(listSubscriptionsFromKeys, "listSubscriptionsFromKeys");
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
__name(notifyPrefsMatchEvent, "notifyPrefsMatchEvent");
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
__name(collectExtraWatched, "collectExtraWatched");
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
__name(isWatchedUnit, "isWatchedUnit");
async function fanout(env, event, subs, dead) {
  subs = subs || await listSubscriptions(env);
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
      if (res.status === 404 || res.status === 410) {
        await env.PUSH_SUBS.delete(row.id);
        if (dead)
          dead.push(row.id);
        else
          await subsIndexRemove(env, [row.id]);
      }
    } catch (_) {
    }
  }));
}
__name(fanout, "fanout");
async function fetchAllReports() {
  const res = await fetch(FIRESTORE_REPORTS + "&key=" + FIRESTORE_KEY);
  if (!res.ok)
    throw new Error("reports " + res.status);
  const data = await res.json();
  return (data.documents || []).map(fsDoc);
}
// Listing trainReports costs one Firestore read per document (about 55 today), and the cron runs 720x/day,
// which alone used ~39K of the 50K free daily reads. Each run now asks two 1-read questions instead (document
// count, and the most recently updated report); the full list is read only when that signature changes, or
// every REPORTS_FULL_SCAN_MS as a safety net for edits that do not touch updatedAt.
var FIRESTORE_DOCS = "https://firestore.googleapis.com/v1/projects/railroadradar-accounts/databases/(default)/documents";
var REPORTS_FULL_SCAN_MS = 30 * 60 * 1e3;
async function fetchReportsSignature() {
  const opts = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const [countRes, topRes] = await Promise.all([
    fetch(FIRESTORE_DOCS + ":runAggregationQuery?key=" + FIRESTORE_KEY, opts({
      structuredAggregationQuery: {
        structuredQuery: { from: [{ collectionId: "trainReports" }] },
        aggregations: [{ alias: "n", count: {} }]
      }
    })),
    fetch(FIRESTORE_DOCS + ":runQuery?key=" + FIRESTORE_KEY, opts({
      structuredQuery: {
        from: [{ collectionId: "trainReports" }],
        orderBy: [{ field: { fieldPath: "updatedAt" }, direction: "DESCENDING" }],
        select: { fields: [{ fieldPath: "updatedAt" }] },
        limit: 1
      }
    }))
  ]);
  if (!countRes.ok || !topRes.ok)
    return null;
  const countJson = await countRes.json();
  const topJson = await topRes.json();
  const agg = Array.isArray(countJson) && countJson[0] && countJson[0].result && countJson[0].result.aggregateFields;
  const n = agg && agg.n ? String(agg.n.integerValue != null ? agg.n.integerValue : "") : "";
  const top = Array.isArray(topJson) && topJson[0] && topJson[0].document;
  if (!n)
    return null;
  return n + "|" + (top ? String(top.name || "").split("/").pop() + "@" + (top.updateTime || "") : "-");
}
__name(fetchAllReports, "fetchAllReports");
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
__name(walkIds, "walkIds");
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
__name(fetchLiveSpecials, "fetchLiveSpecials");
async function scanAndNotify(env) {
  if (!env.PUSH_SUBS || !env.VAPID_PRIVATE_KEY)
    return;
  const subs = await listSubscriptions(env);
  // Nobody to notify: skip the Firestore and feed reads entirely. Subscribing again clears notify:state so the next run re-seeds.
  if (!subs.length)
    return;
  const extra = collectExtraWatched(subs);
  const prev = JSON.parse(await env.PUSH_SUBS.get("notify:state") || '{"reports":{},"live":{}}');
  prev.reports = prev.reports || {};
  prev.live = prev.live || {};
  const now = Date.now();
  // Watched units come from subscriber prefs, so a prefs change also forces a fresh report scan.
  const reportSig = await fetchReportsSignature().catch(() => null);
  const sig = reportSig ? reportSig + "|" + tripHash(JSON.stringify([Array.from(extra.ids).sort(), Array.from(extra.keys).sort()])) : null;
  const needFull = !sig || sig !== prev.reportsSig || !(now - Number(prev.reportsFullAt || 0) < REPORTS_FULL_SCAN_MS) || !prev.reportsFullAt;
  let reports = null;
  if (needFull)
    reports = await fetchAllReports().catch(() => null);
  let reportEvents = {};
  let reportsSig = prev.reportsSig || null;
  let reportsFullAt = prev.reportsFullAt || 0;
  if (!reports) {
    // Unchanged (or the read failed): keep the previous report events as they are.
    reportEvents = prev.reports;
  } else {
    reportsSig = sig;
    reportsFullAt = now;
  }
  (reports || []).forEach((r) => {
    const agency = String(r.agency || "").toLowerCase();
    const locos = reportLocoIds(r);
    locos.forEach((id) => {
      if (!isWatchedUnit(agency, id, extra))
        return;
      const k = "rep|" + r.id + "|" + id;
      reportEvents[k] = {
        type: "report",
        title: "New report: " + (r.unitName || id),
        body: (agencyPretty(r.agency) + (r.trainNumber ? " train " + r.trainNumber : "") + (r.reportedByLabel ? " reported by " + r.reportedByLabel : "")).trim(),
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
  const seeded = !prev.reportsFullAt && !Object.keys(prev.reports || {}).length && !Object.keys(prev.live || {}).length;
  // Only write when the event set changed or a full report scan ran (free-plan KV allows 1,000 writes/day; cron runs 720x/day).
  // Full scans run on report changes plus every 30 min, so this adds about 48 writes/day.
  if (reportsFullAt !== (prev.reportsFullAt || 0) || JSON.stringify({ reports: prev.reports, live: prev.live }) !== JSON.stringify({ reports: reportEvents, live: liveEvents })) {
    await env.PUSH_SUBS.put("notify:state", JSON.stringify({ reports: reportEvents, live: liveEvents, at: now, reportsSig, reportsFullAt }));
  }
  if (seeded)
    return;
  const dead = [];
  for (const evt of fresh.slice(0, 12)) {
    await fanout(env, evt, subs, dead);
  }
  await subsIndexRemove(env, dead);
}
__name(scanAndNotify, "scanAndNotify");
// ---- MyTrips boarding-track alerts (Web Push) ----
// KV layout (PUSH_SUBS, keeps writes low on the free plan):
//   "trips:<subId>"  -> { endpoint, keys, trips:[{k,train,line,dep,stop,dest,sent}], updatedAt }   (expires 1h after last trip)
//   "trips:index"    -> { <subId>: { first, last } }   one read per cron run; written only when a list changes
var TRIP_WATCH_BEFORE_MS = 35 * 60 * 1e3;
var TRIP_WATCH_AFTER_MS = 20 * 60 * 1e3;
var TRIP_MAX = 20;
var PUSH_HOST_RE = /(^|\.)(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|notify\.windows\.com|push\.apple\.com)$/i;
function tripSubId(endpoint) {
  return bytesToB64url(new TextEncoder().encode(endpoint)).slice(0, 88);
}
__name(tripSubId, "tripSubId");
function tripFmtEt(ms) {
  try {
    return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  } catch (_) {
    return new Date(ms).toISOString().slice(11, 16) + " UTC";
  }
}
__name(tripFmtEt, "tripFmtEt");
async function tripIndexGet(env) {
  try {
    return JSON.parse(await env.PUSH_SUBS.get("trips:index") || "{}") || {};
  } catch (_) {
    return {};
  }
}
__name(tripIndexGet, "tripIndexGet");
function tripCleanList(list, now) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((t) => {
    if (!t || out.length >= TRIP_MAX) return;
    const k = String(t.tripKey || "").slice(0, 80);
    const train = String(t.trainNum || "").trim().slice(0, 12);
    const stop = String(t.originStopId || t.parent || "").trim();
    const dep = Date.parse(t.depTimeISO || "");
    if (!k || !train || !/^place-[a-z0-9-]{2,40}$/i.test(stop) || !isFinite(dep)) return;
    const arrIn = Date.parse(t.arrTimeISO || "");
    const endIn = Math.max(isFinite(arrIn) && arrIn >= dep && arrIn - dep < 12 * 36e5 ? arrIn : 0, dep + 2 * 36e5);
    if (endIn < now || dep > now + 7 * 864e5) return;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({
      k,
      train,
      line: String(t.line || "").trim().slice(0, 60),
      dep,
      stop,
      dest: String(t.destination || "").trim().slice(0, 60),
      origin: String(t.originName || "").trim().slice(0, 60),
      arr: (() => {
        const a = Date.parse(t.arrTimeISO || "");
        return isFinite(a) && a >= dep && a - dep < 12 * 36e5 ? a : 0;
      })(),
      rid: /^CR-[A-Za-z]{2,30}$/.test(String(t.routeId || "")) ? String(t.routeId) : "",
      // Alerts the open page already showed, so the cron doesn't repeat them.
      sent: Number(t.boardingSent) || 0,
      hs: Number(t.headsUpSent) || 0,
      late: Number(t.lastLateSentAt) || 0,
      cx: Number(t.cancelSent) || 0
    });
  });
  return out;
}
__name(tripCleanList, "tripCleanList");
async function handlePushTrips(request, env, cors) {
  if (!env.PUSH_SUBS)
    return jsonResponse({ error: "Push store missing" }, 500, cors);
  const body = await request.json().catch(() => null);
  const sub = body && body.subscription;
  if (!sub || !sub.endpoint)
    return jsonResponse({ error: "Invalid subscription" }, 400, cors);
  let host = "";
  try {
    const u = new URL(sub.endpoint);
    if (u.protocol !== "https:") throw new Error("https");
    host = u.hostname;
  } catch (_) {
    return jsonResponse({ error: "Invalid endpoint" }, 400, cors);
  }
  if (!PUSH_HOST_RE.test(host))
    return jsonResponse({ error: "Unsupported push service" }, 400, cors);
  const id = tripSubId(sub.endpoint);
  const key = "trips:" + id;
  const now = Date.now();
  const del = request.method === "DELETE" || !body.trips || !body.trips.length;
  const trips = del ? [] : tripCleanList(body.trips, now);
  const index = await tripIndexGet(env);
  if (!trips.length) {
    await env.PUSH_SUBS.delete(key);
    if (index[id]) {
      delete index[id];
      await env.PUSH_SUBS.put("trips:index", JSON.stringify(index));
    }
    return jsonResponse({ ok: true, trips: 0 }, 200, cors);
  }
  if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth)
    return jsonResponse({ error: "Invalid subscription" }, 400, cors);
  // Keep "sent" flags for trips the device sends again, so a re-sync never re-notifies.
  let prevByKey = {};
  try {
    const prev = JSON.parse(await env.PUSH_SUBS.get(key) || "null");
    (prev && prev.trips || []).forEach((t) => {
      prevByKey[t.k] = t;
    });
  } catch (_) {
  }
  trips.forEach((t) => {
    const p = prevByKey[t.k] || {};
    ["sent", "hs", "late", "cx"].forEach((f) => {
      const v = Math.max(Number(t[f]) || 0, Number(p[f]) || 0);
      if (v) t[f] = v; else delete t[f];
    });
    if (p.al) t.al = p.al;
    if (p.tid) t.tid = p.tid;
    if (!t.rid && p.rid) t.rid = p.rid;
    if (!t.arr) delete t.arr;
    if (!t.rid) delete t.rid;
  });
  trips.sort((a, b) => a.dep - b.dep);
  const first = trips[0].dep;
  const last = trips.reduce((m, t) => Math.max(m, tripEnd(t)), 0);
  const ttl = Math.max(120, Math.ceil((last + 36e5 - now) / 1e3));
  await env.PUSH_SUBS.put(key, JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, trips, updatedAt: now }), { expirationTtl: ttl });
  const old = index[id];
  if (!old || old.first !== first || old.last !== last) {
    index[id] = { first, last };
    await env.PUSH_SUBS.put("trips:index", JSON.stringify(index));
  }
  return jsonResponse({ ok: true, trips: trips.length }, 200, cors);
}
__name(handlePushTrips, "handlePushTrips");
function tripTrackOf(stop) {
  const a = stop && stop.attributes || {};
  if (a.platform_code != null && String(a.platform_code).trim()) return String(a.platform_code).trim();
  const m = String(a.description || a.platform_name || "").match(/track\s+(\d+[A-Za-z]?)/i);
  return m ? m[1] : null;
}
__name(tripTrackOf, "tripTrackOf");
var TRIP_HEADSUP_MS = 30 * 60 * 1e3;
function tripFmtDelay(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? h + " hr" + (m ? " " + m + " min" : "") : m + " min";
}
__name(tripFmtDelay, "tripFmtDelay");
var TRIP_LATE_MIN = 5;
var TRIP_LATE_EVERY_MS = 10 * 60 * 1e3;
var TRIP_ALERT_SKIP_EFFECTS = /* @__PURE__ */ new Set(["ELEVATOR_CLOSURE", "ESCALATOR_CLOSURE", "ACCESS_ISSUE", "PARKING_CLOSURE", "PARKING_ISSUE", "BIKE_ISSUE", "FACILITY_ISSUE", "AMBER_ALERT"]);
async function tripPredictions(env, stop, cache) {
  if (cache[stop]) return cache[stop];
  const url = MBTA_BASE + "/predictions?filter[stop]=" + encodeURIComponent(stop) + "&filter[route_type]=2&include=stop,trip,schedule&page[limit]=150";
  const res = await fetch(url, { headers: env.MBTA_API_KEY ? { "x-api-key": env.MBTA_API_KEY } : {} });
  const out = {};
  if (res.ok) {
    const j = await res.json();
    const inc = {};
    (j.included || []).forEach((x) => {
      inc[x.type + ":" + x.id] = x;
    });
    (j.data || []).forEach((p) => {
      const a = p.attributes || {};
      const rel = p.relationships || {};
      const tr = rel.trip && rel.trip.data;
      const trip = tr ? inc["trip:" + tr.id] : null;
      const name = trip && trip.attributes ? String(trip.attributes.name || "") : "";
      if (!name) return;
      const sc = rel.schedule && rel.schedule.data ? inc["schedule:" + rel.schedule.data.id] : null;
      const sched = sc && sc.attributes && sc.attributes.departure_time ? Date.parse(sc.attributes.departure_time) : 0;
      const sr = String(a.schedule_relationship || "").toUpperCase();
      const cancelled = sr === "CANCELLED" || sr === "SKIPPED";
      if (!a.departure_time && !cancelled) return;
      const st = rel.stop && rel.stop.data;
      const stopRec = st ? inc["stop:" + st.id] : null;
      (out[name] = out[name] || []).push({
        dep: a.departure_time ? Date.parse(a.departure_time) : 0,
        sched,
        cancelled,
        track: tripTrackOf(stopRec),
        headsign: trip.attributes.headsign || "",
        tripId: tr.id,
        routeId: rel.route && rel.route.data ? rel.route.data.id : "",
        stopName: stopRec && stopRec.attributes ? stopRec.attributes.name || "" : ""
      });
    });
  }
  cache[stop] = out;
  return out;
}
__name(tripPredictions, "tripPredictions");
// Trip ends at its arrival (or 2 h after departure if the device didn't send one).
function tripEnd(t) {
  return Math.max(t.arr || 0, t.dep + 2 * 36e5);
}
__name(tripEnd, "tripEnd");
function tripHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = h * 31 + str.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}
__name(tripHash, "tripHash");
// Active MBTA alerts for this train or its whole line (facility alerts skipped).
async function tripAlerts(env, routeId, tripId, cache) {
  if (!routeId) return [];
  if (!cache[routeId]) {
    cache[routeId] = [];
    try {
      const res = await fetch(MBTA_BASE + "/alerts?filter[route]=" + encodeURIComponent(routeId) + "&filter[datetime]=NOW", { headers: env.MBTA_API_KEY ? { "x-api-key": env.MBTA_API_KEY } : {} });
      if (res.ok) cache[routeId] = (await res.json()).data || [];
    } catch (_) {
    }
  }
  const out = [];
  cache[routeId].forEach((al) => {
    const a = al.attributes || {};
    if (TRIP_ALERT_SKIP_EFFECTS.has(String(a.effect || ""))) return;
    const ents = a.informed_entity || [];
    const hits = ents.some((e) => e && (tripId && e.trip === tripId || e.route === routeId && !e.trip && !e.stop));
    if (!hits) return;
    const h = String(a.header || a.short_header || "").replace(/\s+/g, " ").trim();
    if (!h) return;
    out.push({ id: String(al.id), header: h.length > 240 ? h.slice(0, 237) + "\u2026" : h, hash: tripHash(h) });
  });
  return out;
}
__name(tripAlerts, "tripAlerts");
// Builds the due alerts for one trip. Mutates t's flags (sent/hs/late/cx); returns [{title, body, tag}].
async function tripEvents(env, t, now, predCache, alertCache) {
  const evs = [];
  if (t.cx || t.dep - TRIP_WATCH_BEFORE_MS > now || now > tripEnd(t)) return evs;
  const line = t.line || "Train";
  // MBTA service alerts: one notification per alert (re-sent once if its text changes), until the trip ends.
  const routeId = t.rid || "";
  if (routeId || t.tid) {
    const list = await tripAlerts(env, routeId, t.tid || "", alertCache);
    t.al = t.al || {};
    for (const al of list) {
      const prev = t.al[al.id];
      if (prev && (prev.h === al.hash || prev.n >= 2)) continue;
      t.al[al.id] = { h: al.hash, n: prev ? prev.n + 1 : 1 };
      evs.push({ type: "trip", title: line + " " + t.train, body: al.header, tag: "rr-trip-" + t.k + "-alert-" + al.id, url: "/mytrips/" });
    }
    if (!Object.keys(t.al).length) delete t.al;
  }
  if (now - t.dep > TRIP_WATCH_AFTER_MS) return evs;
  const preds = await tripPredictions(env, t.stop, predCache);
  const rows = (preds[t.train] || []).filter((p) => Math.abs((p.dep || p.sched || t.dep) - t.dep) <= 3 * 36e5);
  rows.sort((a, b) => Math.abs((a.dep || a.sched) - t.dep) - Math.abs((b.dep || b.sched) - t.dep));
  const hit = rows[0] || null;
  if (hit && hit.tripId && t.tid !== hit.tripId) t.tid = hit.tripId; // saved with the next write
  if (hit && hit.routeId && !t.rid) t.rid = hit.routeId;
  const dest = hit && hit.headsign || t.dest;
  const origin = t.origin || hit && hit.stopName || "";
  const toDest = dest ? " to " + dest : "";
  const fromOrigin = origin ? " from " + origin : "";
  if (hit && hit.cancelled) {
    t.cx = now;
    evs.push({ type: "trip", title: "Train cancelled", body: line + " " + t.train + toDest + fromOrigin + " has been cancelled", tag: "rr-trip-" + t.k + "-cx", url: "/mytrips/" });
    return evs;
  }
  const sched = hit && hit.sched || t.dep;
  const pred = hit && hit.dep || 0;
  const lateMin = pred && sched ? Math.round((pred - sched) / 6e4) : 0;
  const leaves = pred || sched;
  const gone = hit ? pred && pred < now - 60 * 1e3 : now > sched + 2 * 60 * 1e3;
  if (!t.hs && !gone && sched - now <= TRIP_HEADSUP_MS && (hit || sched - now <= 15 * 60 * 1e3)) {
    const mins = Math.max(1, Math.round((leaves - now) / 6e4));
    const body = lateMin >= TRIP_LATE_MIN
      ? line + " " + t.train + toDest + " is expected to depart " + lateMin + " min late at " + tripFmtEt(pred) + fromOrigin
      : line + " " + t.train + toDest + " is expected to depart On Time at " + tripFmtEt(sched) + fromOrigin;
    evs.push({ type: "trip", title: "Departing in " + mins + " min", body, tag: "rr-trip-" + t.k + "-30", url: "/mytrips/" });
    t.hs = now;
    if (lateMin >= TRIP_LATE_MIN) t.late = now;
  } else if (t.hs && hit && pred > now && lateMin >= TRIP_LATE_MIN && (!t.late || now - t.late >= TRIP_LATE_EVERY_MS - 30 * 1e3)) {
    const body = "Now expected to depart " + (origin ? origin + " " : "") + "at " + tripFmtEt(pred);
    evs.push({ type: "trip", title: line + " " + t.train + " is delayed by " + tripFmtDelay(lateMin), body, tag: "rr-trip-" + t.k + "-late", url: "/mytrips/" });
    t.late = now;
  }
  if (!t.sent && hit && hit.track && !gone) {
    t.sent = now;
    evs.push({ type: "trip", title: "Boarding on track " + hit.track, body: line + " " + t.train + " (" + tripFmtEt(t.dep) + ")" + toDest, tag: "rr-trip-" + t.k, url: "/mytrips/" });
  }
  return evs;
}
__name(tripEvents, "tripEvents");
async function scanTripAlerts(env, nowOverride) {
  if (!env.PUSH_SUBS || !env.VAPID_PRIVATE_KEY)
    return { checked: 0, sent: 0 };
  const now = nowOverride || Date.now();
  const index = await tripIndexGet(env);
  const ids = Object.keys(index);
  if (!ids.length) return { checked: 0, sent: 0 };
  let indexDirty = false;
  const due = [];
  ids.forEach((id) => {
    const e = index[id] || {};
    if (!(e.last >= now - TRIP_WATCH_AFTER_MS)) {
      delete index[id];
      indexDirty = true;
      return;
    }
    if (e.first - TRIP_WATCH_BEFORE_MS <= now) due.push(id);
  });
  const predCache = {};
  const alertCache = {};
  let checked = 0, sent = 0;
  for (const id of due.slice(0, 50)) {
    const key = "trips:" + id;
    let rec = null;
    try {
      rec = JSON.parse(await env.PUSH_SUBS.get(key) || "null");
    } catch (_) {
    }
    if (!rec || !rec.trips) {
      delete index[id];
      indexDirty = true;
      continue;
    }
    let changed = false;
    let gone = false;
    for (const t of rec.trips) {
      let evs = [];
      try {
        evs = await tripEvents(env, t, now, predCache, alertCache);
      } catch (_) {
        continue;
      }
      checked++;
      for (const evt of evs) {
        changed = true;
        try {
          const res = await sendWebPush(env, rec, evt);
          if (res.status === 404 || res.status === 410) gone = true;
          else sent++;
        } catch (_) {
        }
        if (gone) break;
      }
      if (gone) break;
    }
    if (gone) {
      await env.PUSH_SUBS.delete(key);
      delete index[id];
      indexDirty = true;
    } else if (changed) {
      // One write per device per run, only when an alert went out.
      const last = rec.trips.reduce((m, t) => Math.max(m, tripEnd(t)), 0);
      const ttl = Math.max(120, Math.ceil((last + 36e5 - now) / 1e3));
      await env.PUSH_SUBS.put(key, JSON.stringify(rec), { expirationTtl: ttl });
    }
  }
  if (indexDirty) await env.PUSH_SUBS.put("trips:index", JSON.stringify(index));
  return { checked, sent };
}
__name(scanTripAlerts, "scanTripAlerts");

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
__name(schedulesCacheUrl, "schedulesCacheUrl");
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
__name(cacheGetText, "cacheGetText");
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
__name(cachePutText, "cachePutText");
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
__name(cacheGetBuf, "cacheGetBuf");
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
__name(cachePutBuf, "cachePutBuf");
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
__name(parseCsv, "parseCsv");
function u16(view, off) {
  return view.getUint16(off, true);
}
__name(u16, "u16");
function u32(view, off) {
  return view.getUint32(off, true);
}
__name(u32, "u32");
async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not available");
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
__name(inflateRaw, "inflateRaw");
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
__name(unzipNamedFiles, "unzipNamedFiles");
function ymdToDateParts(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m)
    return null;
  return { y: +m[1], mo: +m[2], d: +m[3], compact: m[1] + m[2] + m[3] };
}
__name(ymdToDateParts, "ymdToDateParts");
function weekdayField(ymd) {
  const p = ymdToDateParts(ymd);
  if (!p)
    return null;
  const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0));
  const wd = dt.getUTCDay();
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][wd];
}
__name(weekdayField, "weekdayField");
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
__name(serviceIdsForDate, "serviceIdsForDate");
function naturalTrainSort(a, b) {
  return String(a.trainNumber || "").localeCompare(String(b.trainNumber || ""), void 0, {
    numeric: true,
    sensitivity: "base"
  });
}
__name(naturalTrainSort, "naturalTrainSort");
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
__name(trainsFromGtfsFiles, "trainsFromGtfsFiles");
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
__name(fetchGtfsZip, "fetchGtfsZip");
async function schedulesFromStaticGtfs(agency, ymd) {
  const zipAgency = agency === "ctrail" ? "ctrail" : agency;
  const buf = await fetchGtfsZip(zipAgency);
  const files = await unzipNamedFiles(buf, ["trips.txt", "routes.txt", "calendar.txt", "calendar_dates.txt"]);
  if (!files["trips.txt"])
    throw new Error("trips.txt missing in GTFS for " + agency);
  return trainsFromGtfsFiles(files, agency, ymd);
}
__name(schedulesFromStaticGtfs, "schedulesFromStaticGtfs");
function extractMbtaTrainNumber(tripId) {
  if (!tripId)
    return "";
  const parts = String(tripId).split("-");
  return parts.length > 2 ? parts[2] : String(tripId);
}
__name(extractMbtaTrainNumber, "extractMbtaTrainNumber");
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
      const trip = tripById[tid];
      // Official MBTA train number (trip attributes.name); parse the trip ID only if it's blank.
      const official = trip && trip.attributes ? String(trip.attributes.name || "").trim() : "";
      const num = official || extractMbtaTrainNumber(tid);
      if (!num || byNum[num])
        return;
      const rid2 = s.relationships && s.relationships.route && s.relationships.route.data && s.relationships.route.data.id || trip && trip.relationships && trip.relationships.route && trip.relationships.route.data && trip.relationships.route.data.id || rid;
      const route = routeById[rid2];
      const name = route && route.attributes && (route.attributes.long_name || route.attributes.short_name) || rid2 || "MBTA";
      const dest = trip && trip.attributes && trip.attributes.headsign || "";
      byNum[num] = { trainNumber: num, name: String(name), dest: String(dest || "") };
    });
  }
  __name(oneRoute, "oneRoute");
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
__name(schedulesFromMbta, "schedulesFromMbta");
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
__name(handleSchedules, "handleSchedules");
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
__name(warmLiveCaches, "warmLiveCaches");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = corsHeaders(request, env);
    if (path === "/api/press/notify") return handlePressNotify(request, env);
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
    if ((request.method === "POST" || request.method === "DELETE") && (path === "/api/push/trips" || path === "/push/trips")) {
      try {
        return await handlePushTrips(request, env, cors);
      } catch (err) {
        return jsonResponse({ error: "Trips save failed" }, 500, cors);
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
            "/api/push/vapid",
            "/api/push/subscribe",
            "/api/push/trips",
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
      try {
        await scanTripAlerts(env);
      } catch (_) {
      }
    })());
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
const PROJECT_ID = 'railroadradar-accounts';
const BOOTSTRAP_ADMIN_EMAILS = ['turokerr@gmail.com', 'railroadradar@gmail.com'];
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const PRESS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function b64urlBytes(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Returns the token's claims if it is a valid Firebase ID token for this project, else null.
async function verifyFirebaseIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const header = JSON.parse(new TextDecoder().decode(b64urlBytes(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlBytes(p)));
  const now = Date.now() / 1000;
  if (header.alg !== 'RS256' || claims.aud !== PROJECT_ID
    || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}`
    || !claims.sub || claims.exp < now || claims.iat > now + 300) return null;
  const { keys } = await (await fetch(GOOGLE_JWKS, { cf: { cacheTtl: 3600 } })).json();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  return ok ? claims : null;
}

async function isPressAdmin(token, claims) {
  const email = String(claims.email || '').toLowerCase();
  if (!email || claims.email_verified !== true) return false;
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) return true;
  // Firestore rules let a signed-in user read their own admins/{email} doc.
  const r = await fetch(`${FIRESTORE}/admins/${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok;
}

async function handlePressNotify(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PRESS_CORS });
  const reply = (status, msg) => new Response(msg, { status, headers: PRESS_CORS });
  if (request.method !== 'POST') return reply(405, 'POST only');

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const claims = await verifyFirebaseIdToken(token).catch(() => null);
  if (!claims) return reply(401, 'Sign in again');
  if (!(await isPressAdmin(token, claims))) return reply(403, 'Admins only');

  const { slug } = await request.json().catch(() => ({}));
  if (!slug || typeof slug !== 'string') return reply(400, 'Missing slug');
  const doc = await fetch(`${FIRESTORE}/pressReleases/${encodeURIComponent(slug)}`);
  if (!doc.ok) return reply(404, 'No such press release');
  const f = (await doc.json()).fields || {};
  const title = String(f.title?.stringValue || 'Press release').slice(0, 256);
  const body = String(f.body?.stringValue || '').trim();
  const image = f.images?.arrayValue?.values?.[0]?.mapValue?.fields?.url?.stringValue;
  const url = `https://railroadradar.com/press/index.html?id=${encodeURIComponent(slug)}`;

  // Discord caps an embed description at 4096 characters and a message at 10 embeds.
  const chunks = [];
  for (let i = 0; i < body.length && chunks.length < 10; i += 4096) chunks.push(body.slice(i, i + 4096));
  if (!chunks.length) chunks.push('');
  const embeds = chunks.map((description, i) => ({
    title: i ? `${title} (cont.)`.slice(0, 256) : title,
    url,
    description,
    color: 706304,
    footer: { text: 'RailroadRadar Press' },
    timestamp: new Date().toISOString(),
  }));
  if (image) embeds[0].image = { url: image };

  const sent = await fetch(env.DISCORD_PRESS_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RailroadRadar', embeds }),
  });
  return reply(sent.ok ? 204 : 502, sent.ok ? null : 'Discord rejected the post');
}
