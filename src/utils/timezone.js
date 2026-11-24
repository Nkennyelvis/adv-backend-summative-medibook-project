// the server's timezone as '+02:00'. MySQL sessions use this so NOW() / CURDATE()
// in SQL match new Date() in JavaScript (docker MySQL is in UTC by default)
function localOffset() {
  const mins = -new Date().getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

module.exports = { localOffset };
