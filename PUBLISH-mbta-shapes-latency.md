# Publish: MBTA shapes latency (2026-09-29)

## Ask
Main map still slow after proxy Cache API fix. Network: `shapes?filter[route]=CR-Newburyport&page[limit]=1000` → 200, **5.8 kB / 1.59 s** (proxy/MBTA TTFB, not download).

## Root cause
1. Main map loaded **13+ per-route** MBTA shapes via `railroadradar-proxy` → `api-v3.mbta.com`.
2. Worker Cache API for those paths used **max-age=15s** (same as live vehicles). Cache expires quickly; colo-local Cache + no shape warm ⇒ frequent **MISS → ~1–2s MBTA TTFB** each.
3. Cron warmed vehicles only, not shapes. Metra/Amtrak HITs looked fine; MBTA shapes did not.

## Fix
### Site (this workflow)
- Add `/assets/shapes/mbta.json` (~47KB simplified CR + CapeFlyer polylines).
- `fetchRouteShapes` loads static pack first (with other GTFS agencies); **skips per-route API** when `gtfs-mbta-*` layers register.
- Trip maps: `ensureTripShapesForMiles('mbta')` prefers same static pack.
- Splash still hides before shapes (`bg.push(fetchRouteShapes)` unchanged).

### Worker (deploy separately — CF OAuth expired in agent box)
- `mbtaCacheTtl`: shapes/routes **21600s**; vehicles stay 15s.
- Cron warms all `MBTA_CR_ROUTES` + CapeFlyer shapes + CR routes list.

## Artifact
- `scripts/mbta-shapes-latency.patch.gz.b64`
- sha256 b64 `7ec2f66e63b6b31506f0845e80e103f05f90275477f8c34280398c6b0328ce32`
- `assets/shapes/mbta.json`
- Workflow: `.github/workflows/apply-mbta-shapes-latency.yml`

## Worker deploy (manual)
```bash
cd cloudflare-proxy && wrangler deploy
```
Source: `/workspace/railroadradar-pairing/cloudflare-proxy/worker.js`
