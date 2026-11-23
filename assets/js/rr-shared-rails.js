/* Merge route shapes that follow the same track into one line.
   A shared stretch keeps one geometry and shows each railroad's color
   as a solid base plus dashed overlays. No geographic offset. */
(function (root) {
  'use strict';
  var SNAP = 48;
  var CELL = SNAP / 111320;
  var PRIORITY = { mbta: 0, amtrak: 1, mnr: 2, lirr: 3, njt: 4, ctrail: 5, marc: 6, via: 7, brightline: 8 };

  function distM(a, b) {
    var dlat = (a[0] - b[0]) * 111320;
    var dlon = (a[1] - b[1]) * 111320 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
    return Math.hypot(dlat, dlon);
  }

  function build(pieces) {
    var ordered = (pieces || []).slice().sort(function (a, b) {
      return (PRIORITY[a.agency] == null ? 9 : PRIORITY[a.agency]) - (PRIORITY[b.agency] == null ? 9 : PRIORITY[b.agency]);
    });
    var nodes = [];
    var grid = new Map();
    var edgeMap = new Map();

    function nearestNode(lat, lng) {
      var c = Math.max(0.2, Math.cos(lat * Math.PI / 180));
      var ci = Math.round(lat / CELL);
      var cj = Math.round(lng / (CELL / c));
      var best = -1;
      var bestD = SNAP;
      for (var di = -1; di <= 1; di++) {
        for (var dj = -1; dj <= 1; dj++) {
          var arr = grid.get((ci + di) + ':' + (cj + dj));
          if (!arr) continue;
          for (var k = 0; k < arr.length; k++) {
            var n = nodes[arr[k]];
            var d = distM([lat, lng], [n.lat, n.lng]);
            if (d < bestD) { bestD = d; best = arr[k]; }
          }
        }
      }
      return best;
    }

    function addNode(lat, lng) {
      var hit = nearestNode(lat, lng);
      if (hit >= 0) return hit;
      var idx = nodes.length;
      nodes.push({ lat: lat, lng: lng, edges: [] });
      var c = Math.max(0.2, Math.cos(lat * Math.PI / 180));
      var key = Math.round(lat / CELL) + ':' + Math.round(lng / (CELL / c));
      var arr = grid.get(key);
      if (!arr) { arr = []; grid.set(key, arr); }
      arr.push(idx);
      return idx;
    }

    function touchEdge(i, j, meta) {
      if (i === j || i < 0 || j < 0) return;
      var k = i < j ? i + ':' + j : j + ':' + i;
      var e = edgeMap.get(k);
      if (!e) {
        e = { a: i, b: j, colors: new Map() };
        edgeMap.set(k, e);
        nodes[i].edges.push(e);
        nodes[j].edges.push(e);
      }
      var list = e.colors.get(meta.color);
      if (!list) { list = []; e.colors.set(meta.color, list); }
      for (var n = 0; n < list.length; n++) {
        if (list[n].agency === meta.agency && list[n].routeId === meta.routeId) return;
      }
      list.push({ agency: meta.agency, routeId: meta.routeId, name: meta.name, color: meta.color });
    }

    function pathBetween(start, goal, maxMeters) {
      var dist = new Map();
      dist.set(start, 0);
      var prev = new Map();
      var heap = [start];
      var visits = 0;
      while (heap.length && visits < 400) {
        var bi = 0;
        for (var i = 1; i < heap.length; i++) if (dist.get(heap[i]) < dist.get(heap[bi])) bi = i;
        var cur = heap.splice(bi, 1)[0];
        visits++;
        if (cur === goal) break;
        var node = nodes[cur];
        for (var ei = 0; ei < node.edges.length; ei++) {
          var e = node.edges[ei];
          var nxt = e.a === cur ? e.b : e.a;
          var nd = dist.get(cur) + distM([node.lat, node.lng], [nodes[nxt].lat, nodes[nxt].lng]);
          if (nd > maxMeters) continue;
          if (dist.has(nxt) && dist.get(nxt) <= nd) continue;
          dist.set(nxt, nd);
          prev.set(nxt, cur);
          heap.push(nxt);
        }
      }
      if (!prev.has(goal)) return null;
      var seq = [goal];
      var p = goal;
      while (p !== start) {
        p = prev.get(p);
        if (p == null) return null;
        seq.push(p);
      }
      seq.reverse();
      return seq;
    }

    function paint(seq, meta) {
      for (var i = 1; i < seq.length; i++) touchEdge(seq[i - 1], seq[i], meta);
    }

    ordered.forEach(function (piece) {
      if (!piece || !piece.pts || piece.pts.length < 2) return;
      var prev = -1;
      var prevWasNew = true;
      for (var i = 0; i < piece.pts.length; i++) {
        var pt = piece.pts[i];
        var hit = nearestNode(pt[0], pt[1]);
        var existed = hit >= 0;
        var node = existed ? hit : addNode(pt[0], pt[1]);
        if (prev >= 0 && prev !== node) {
          var d = distM([nodes[prev].lat, nodes[prev].lng], [nodes[node].lat, nodes[node].lng]);
          if (existed && !prevWasNew && d > 160) {
            var seq = pathBetween(prev, node, Math.min(d * 1.55 + 400, 30000));
            if (seq && seq.length > 2) paint(seq, piece);
            else touchEdge(prev, node, piece);
          } else touchEdge(prev, node, piece);
        }
        prev = node;
        prevWasNew = !existed;
      }
    });

    var unused = [];
    edgeMap.forEach(function (e) {
      e.sig = Array.from(e.colors.keys()).sort().join('|');
      unused.push(e);
    });
    var used = new Set();
    var runs = [];

    function nextEdge(nodeIdx, prevEdge, sig) {
      var n = nodes[nodeIdx];
      var found = null;
      var count = 0;
      for (var i = 0; i < n.edges.length; i++) {
        var e = n.edges[i];
        if (e === prevEdge || e.sig !== sig || used.has(e)) continue;
        found = e;
        count++;
        if (count > 1) return null;
      }
      return count === 1 ? found : null;
    }

    function takeOwners(edges) {
      var owners = [];
      var seen = {};
      edges.forEach(function (edge) {
        edge.colors.forEach(function (list) {
          list.forEach(function (o) {
            var k = o.agency + '|' + o.routeId;
            if (seen[k]) return;
            seen[k] = 1;
            owners.push(o);
          });
        });
      });
      return owners;
    }

    unused.forEach(function (start) {
      if (used.has(start)) return;
      used.add(start);
      var sig = start.sig;
      var seq = [start.a, start.b];
      var edges = [start];
      var prevE = start;
      var node = start.b;
      for (;;) {
        var e = nextEdge(node, prevE, sig);
        if (!e) break;
        used.add(e);
        edges.push(e);
        var nxt = e.a === node ? e.b : e.a;
        seq.push(nxt);
        prevE = e;
        node = nxt;
      }
      var pre = [];
      var preEdges = [];
      prevE = start;
      node = start.a;
      for (;;) {
        var e2 = nextEdge(node, prevE, sig);
        if (!e2) break;
        used.add(e2);
        preEdges.push(e2);
        var nxt2 = e2.a === node ? e2.b : e2.a;
        pre.push(nxt2);
        prevE = e2;
        node = nxt2;
      }
      pre.reverse();
      preEdges.reverse();
      var ids = pre.concat(seq);
      var owners = takeOwners(preEdges.concat(edges));
      var colors = {};
      owners.forEach(function (o) { colors[o.color] = 1; });
      runs.push({
        pts: ids.map(function (id) { return [nodes[id].lat, nodes[id].lng]; }),
        owners: owners,
        nColors: Object.keys(colors).length
      });
    });
    return runs;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function paint(runs, visibleAgency) {
    if (!root.L) return null;
    var group = root.L.layerGroup();
    (runs || []).forEach(function (run) {
      if (!run.pts || run.pts.length < 2) return;
      var owners = (run.owners || []).filter(function (o) { return visibleAgency(o.agency); });
      if (!owners.length) return;
      var colors = [];
      var seenC = {};
      owners.forEach(function (o) {
        if (seenC[o.color]) return;
        seenC[o.color] = 1;
        colors.push(o.color);
      });
      var names = [];
      var seenN = {};
      owners.forEach(function (o) {
        var label = o.name || o.routeId;
        var k = o.agency + '|' + label;
        if (seenN[k]) return;
        seenN[k] = 1;
        names.push({ color: o.color, label: label });
      });
      var html = names.map(function (n) {
        return '<div style="display:flex;align-items:center;gap:8px;margin:2px 0"><span style="width:18px;height:4px;background:' + esc(n.color) + ';display:inline-block"></span><span>' + esc(n.label) + '</span></div>';
      }).join('');
      var weight = colors.length > 1 ? 4 : 3;
      var base = root.L.polyline(run.pts, {
        color: colors[0],
        weight: weight,
        opacity: 1,
        interactive: true,
        className: 'gtfs-shape-line'
      });
      base.bindPopup('<div class="rr-route-lines-pop">' + html + '</div>', { maxWidth: 280 });
      group.addLayer(base);
      if (colors.length > 1) {
        var dash = 12;
        var gap = dash * (colors.length - 1);
        for (var i = 1; i < colors.length; i++) {
          group.addLayer(root.L.polyline(run.pts, {
            color: colors[i],
            weight: weight,
            opacity: 1,
            dashArray: dash + ' ' + gap,
            dashOffset: String(-(i - 1) * dash),
            interactive: false,
            className: 'gtfs-shape-line'
          }));
        }
      }
    });
    return group;
  }

  root.rrBuildSharedRailRuns = build;
  root.rrPaintSharedRailLines = paint;
})(typeof window !== 'undefined' ? window : globalThis);
