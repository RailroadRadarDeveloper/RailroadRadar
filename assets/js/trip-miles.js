// Amtrak miles saved before the stop-chain fix. Unordered Amtrak station lists include branches, so the
// old estimate could zigzag through them (Boston to New York saved as 516 mi). Today's estimate rejects
// any stop chain longer than 1.6 times the straight line plus 8 mi, so a stored Amtrak segment above that
// bound can only be a pre-fix value. It is measured again the way a save measures it now: along the
// line's track shape when loaded, else the straight line. Nothing is written back; editing the trip saves
// the new value. Shared by the MyTrips page and the public profile page.
(function () {
  var SNAP_MI = 1.5;
  var byId = null;
  function station(id) {
    if (!byId) {
      byId = {};
      (typeof AMTRAK_TRIP_STATIONS !== 'undefined' ? AMTRAK_TRIP_STATIONS : []).forEach(function (s) { byId[String(s.id)] = s; });
    }
    var s = byId[String(id || '')];
    return s && isFinite(+s.lat) && isFinite(+s.lon) ? s : null;
  }
  function hav(lat1, lon1, lat2, lon2) {
    var r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function snap(lat, lon, pl) {
    var best = Infinity, at = 0, cum = 0;
    for (var i = 0; i < pl.length - 1; i++) {
      var a = pl[i], b = pl[i + 1], dx = b[1] - a[1], dy = b[0] - a[0];
      var t = dx || dy ? Math.max(0, Math.min(1, ((lon - a[1]) * dx + (lat - a[0]) * dy) / (dx * dx + dy * dy))) : 0;
      var seg = hav(a[0], a[1], b[0], b[1]), d = hav(lat, lon, a[0] + t * dy, a[1] + t * dx);
      if (d < best) { best = d; at = cum + t * seg; }
      cum += seg;
    }
    return { dist: best, along: at };
  }
  function polylines(lineId) {
    var pack = window.RR_TRIP_SHAPES && window.RR_TRIP_SHAPES.amtrak;
    var polys = pack && lineId ? pack[String(lineId)] : null;
    return polys && polys.length ? polys : [];
  }
  function segmentsOf(trip) {
    if (Array.isArray(trip.segments) && trip.segments.length) return trip.segments;
    return [{ railroad: trip.railroad, lineId: trip.lineId, originStationId: trip.originStationId, destStationId: trip.destStationId, miles: trip.miles }];
  }
  // Corrected miles for a stale Amtrak segment, or null when the stored value is fine.
  function staleSegmentMiles(seg, trip) {
    if (String(seg.railroad || trip.railroad || '').toLowerCase() !== 'amtrak') return null;
    var stored = Number(seg.miles);
    var o = station(seg.originStationId), d = station(seg.destStationId);
    if (!(stored > 0) || !o || !d) return null;
    var od = hav(+o.lat, +o.lon, +d.lat, +d.lon);
    if (!(od > 0) || stored <= od * 1.6 + 8) return null;
    var along = null;
    polylines(seg.lineId || trip.lineId).forEach(function (pl) {
      var a = snap(+o.lat, +o.lon, pl), b = snap(+d.lat, +d.lon, pl), mi = Math.abs(a.along - b.along);
      if (a.dist <= SNAP_MI && b.dist <= SNAP_MI && mi > 0 && (along == null || mi < along)) along = mi;
    });
    return Math.round((along != null ? along : od) * 10) / 10;
  }
  // Line ids whose shapes would correct this trip's stale segments (empty when nothing is stale).
  function shapesNeeded(trip) {
    if (!trip) return [];
    return segmentsOf(trip).filter(function (s) { return staleSegmentMiles(s, trip) != null; })
      .map(function (s) { return String(s.lineId || trip.lineId || ''); });
  }
  // The trip's miles and segments with stale Amtrak segments corrected, or null when nothing is stale.
  function correctedTrip(trip) {
    if (!trip) return null;
    var removed = 0, added = 0;
    var segs = segmentsOf(trip).map(function (s) {
      var fixed = staleSegmentMiles(s, trip);
      if (fixed == null) return s;
      removed += Number(s.miles);
      added += fixed;
      return Object.assign({}, s, { miles: fixed });
    });
    if (!removed) return null;
    var hasSegs = Array.isArray(trip.segments) && trip.segments.length > 0;
    var stored = Number(trip.miles);
    // Keep any other part of the stored total; only swap the stale segments for their corrected miles.
    var miles = stored > 0 ? Math.max(0, stored - removed) + added
      : segs.reduce(function (sum, s) { return sum + (Number(s.miles) || 0); }, 0);
    return { miles: Math.round(miles * 10) / 10, segments: hasSegs ? segs : trip.segments };
  }
  window.rrTripMilesFix = { correctedTrip: correctedTrip, shapesNeeded: shapesNeeded };
})();
