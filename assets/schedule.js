/* Match dates belong to Japan, regardless of the viewer's device timezone. */
const Schedule = (() => {
  function todayInJapan(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const value = type => parts.find(part => part.type === type).value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  }

  function isPastUnreported(match, now = new Date()) {
    return !match.result && Boolean(match.date) && match.date < todayInJapan(now);
  }

  function nextMatch(matches, now = new Date()) {
    const today = todayInJapan(now);
    // Keep today's game visible until its result is available. A missed result
    // from an earlier day must never hide the next scheduled match.
    const scheduled = matches.filter(match => !match.result && match.date >= today)
      .slice().sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
    return scheduled[0] || matches.find(match => !match.result && !match.date) || null;
  }

  return { todayInJapan, isPastUnreported, nextMatch };
})();

if (typeof module !== "undefined") module.exports = Schedule;
