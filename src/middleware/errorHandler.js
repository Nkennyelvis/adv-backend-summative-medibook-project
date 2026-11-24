const HttpError = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

// every error ends up here (express 5 passes errors from async handlers automatically)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // bad JSON in the request body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.code) body.code = err.code;
    if (err.extra.details) body.details = err.extra.details;
    if (err.extra.waitlist) {
      body.waitlist = {
        ...err.extra.waitlist,
        message: 'You can join the waitlist with POST /api/waitlist',
      };
    }
    return res.status(err.status).json(body);
  }

  // MySQL errors we expect
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with this email or phone already exists' });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ error: 'This record has appointments linked to it, so it cannot be deleted' });
  }
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(422).json({ error: 'The data breaks a database rule', details: err.sqlMessage });
  }
  if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(err.code)) {
    console.error('Database error:', err.message);
    return res.status(503).json({ error: 'Database is not available' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the server' });
}

module.exports = { notFound, errorHandler };
