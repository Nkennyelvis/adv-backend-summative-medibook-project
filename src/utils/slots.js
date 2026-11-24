const OPEN_HOUR = 9;
const CLOSE_HOUR = 17; // last slot starts 16:30 and ends 17:00
const SLOT_MINUTES = 30;
const MAX_PER_DAY = 12;

const pad = (n) => String(n).padStart(2, '0');

// accepts '2026-12-01 09:30', '2026-12-01T09:30' or with ':00' seconds
// returns null if the text is not a real date/time
function parseDateTime(text) {
  if (typeof text !== 'string') return null;
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v || 0));
  const date = new Date(y, mo - 1, d, h, mi, s);
  // catches things like 2026-02-30 or 25:00 that JS would roll over
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d
    || date.getHours() !== h || date.getMinutes() !== mi || date.getSeconds() !== s) {
    return null;
  }
  return date;
}

function parseDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return parseDateTime(`${text} 00:00`);
}

function toSqlDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toSqlDate(date) {
  return toSqlDateTime(date).slice(0, 10);
}

// returns an error message, or null if the slot is ok
function checkSlot(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Invalid date/time';
  if (date.getMinutes() % SLOT_MINUTES !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0) {
    return 'Appointments must start on the hour or half hour (e.g. 09:00 or 09:30)';
  }
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < OPEN_HOUR * 60 || minutes + SLOT_MINUTES > CLOSE_HOUR * 60) {
    return 'Appointments must be between 09:00 and 17:00 (last slot is 16:30)';
  }
  if (date <= now) return 'Appointments must be booked in the future';
  return null;
}

module.exports = {
  OPEN_HOUR, CLOSE_HOUR, SLOT_MINUTES, MAX_PER_DAY,
  parseDateTime, parseDate, toSqlDateTime, toSqlDate, checkSlot,
};
