// Refund policy (based on hours of notice before the appointment):
//   more than 48 hours       -> 100%
//   24 hours up to 48 hours  -> 50%   (exactly 48h and exactly 24h are both 50%)
//   less than 24 hours       -> 0%
function refundPercent(hoursNotice) {
  if (hoursNotice > 48) return 100;
  if (hoursNotice >= 24) return 50;
  return 0;
}

function calculateRefund(amountPaid, appointmentTime, cancelTime = new Date()) {
  const hoursNotice = (new Date(appointmentTime) - new Date(cancelTime)) / (1000 * 60 * 60);
  const percent = refundPercent(hoursNotice);
  // work in cents so we don't get 74.99999
  const cents = Math.round(Number(amountPaid) * 100);
  const amount = Math.round((cents * percent) / 100) / 100;
  return { hoursNotice: Math.round(hoursNotice * 100) / 100, percent, amount };
}

module.exports = { refundPercent, calculateRefund };
