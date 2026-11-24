// small error class so services can say which status code to send
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = extra.code;
    this.extra = extra;
  }
}

module.exports = HttpError;
