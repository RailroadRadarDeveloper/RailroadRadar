/* When a rider opens Report Train from a live train popup, keep that exact train selected.
   If it is not in the schedule response (for example, a live-only or newly added train), add it
   as a clearly marked option instead of making the rider scroll the full train list or retype it. */
(function () {
  'use strict';

  var original = window.openReportTrainModal;
  if (typeof original !== 'function' || window.__rrLivePopupReportPrefillInstalled) return;
  window.__rrLivePopupReportPrefillInstalled = true;

  function normalized(value) {
    var s = String(value == null ? '' : value).trim();
    return /^\d+$/.test(s) ? (s.replace(/^0+(?=\d)/, '') || '0') : s.toLowerCase();
  }

  window.openReportTrainModal = function (opts) {
    opts = opts || {};
    var agency = String(opts.agency || 'mbta').trim().toLowerCase();
    var trainNumber = String(opts.trainNumber == null ? '' : opts.trainNumber).trim();
    var select = document.getElementById('report-train-select');

    if (agency !== 'mbta' && trainNumber && select && typeof MutationObserver === 'function') {
      var observer = null;
      var applied = false;

      function applyLiveTrainSelection() {
        if (applied) return true;
        var options = Array.prototype.slice.call(select.options || []);
        if (!options.length || /loading trains/i.test(String(options[0].textContent || ''))) return false;

        var wanted = normalized(trainNumber);
        var match = options.find(function (option) {
          return option.value && normalized(option.value) === wanted;
        });

        if (!match) {
          match = document.createElement('option');
          match.value = trainNumber;
          match.textContent = 'Train ' + trainNumber + ' · Live train';
          select.insertBefore(match, select.options[1] || null);
        }

        var extra = document.getElementById('report-train-extra-btn');
        if (extra && extra.getAttribute('aria-pressed') === 'true') extra.click();

        select.disabled = false;
        select.value = match.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        applied = true;
        if (observer) observer.disconnect();
        return true;
      }

      observer = new MutationObserver(function () {
        applyLiveTrainSelection();
      });
      observer.observe(select, { childList: true });
      var result = original.call(this, opts);
      applyLiveTrainSelection();
      return result;
    }

    return original.call(this, opts);
  };
})();
