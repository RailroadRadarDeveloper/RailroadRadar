# Publish: Proxy latency + startup load (2026-09-29)

## Ask
All network requests via the Cloudflare proxy felt forever-slow; whole app load painful.

## Root cause (evidence)
1. **Worker edge cache ineffective**: `proxyBinary` used `cf.cacheEverything: false`, so GTFS-RT / Amtrak origins were re-fetched on nearly every request. Metra `/api/metra/positions` measured **0.5–3.0s**; no `cf-cache-status` / no shared HIT. After Cache API + `cacheEverything: true`: Metra **HIT ~40ms**.
2. **Startup waterfall**: splash awaited sequential MBTA `/api/mbta/shapes` for all CR routes + ~900KB `amtrak.json` **before** hide, even when MBTA off. Shapes sequential ~1s+ when warm; worse under contention with Mapbox tiles on the same `workers.dev` host.

## Fix
### Worker (deployed via wrangler)
- Cache API HIT path + `cacheEverything: true` on upstream
- Drop `Vary: Origin` when ACAO is `*`
- Cron warms Amtrak/MTA/Metra/MBTA live feeds every 2m
- Version: `ec7d34cc-ef5b-438e-b0b2-37c0f44d03fb` @ `https://railroadradar-proxy.railroadradar.workers.dev`

### Site
- First paint: parallel live trains for enabled rails; hide splash ASAP
- Defer `fetchRouteShapes` to background; parallelize MBTA shapes (concurrency 6)
- Gate `fetchStations` / MBTA shapes on `showMbta`; skip disabled static shape agencies

## Artifact
- `scripts/proxy-latency-startup.patch.gz.b64` (+ `.part1`)
- sha256 b64 `1bb60e61a4f003c9080e60e88cb42cc3200318bee02a19bcf2f94cb9ddaf4015`
- Workflow: `.github/workflows/apply-proxy-latency-startup.yml`
