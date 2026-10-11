// Paste into railroadradar-proxy (same worker as Metra/NJT).
// After deploy, index.html reads MARC from /api/marc/positions and /api/marc/tripupdates.
// Official MDOT S3 has no CORS, so the browser cannot fetch these directly.

const MARC_VP = 'https://mdotmta-gtfs-rt.s3.amazonaws.com/MARC+RT/marc-vp.pb';
const MARC_TU = 'https://mdotmta-gtfs-rt.s3.amazonaws.com/MARC+RT/marc-tu.pb';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

async function proxyPb(url) {
  const upstream = await fetch(url, { cache: 'no-store' });
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: {
      ...CORS,
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  });
}

// Inside the worker fetch handler:
// if (url.pathname === '/api/marc/positions') return proxyPb(MARC_VP);
// if (url.pathname === '/api/marc/tripupdates') return proxyPb(MARC_TU);
// if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/marc/')) {
//   return new Response(null, { status: 204, headers: CORS });
// }
