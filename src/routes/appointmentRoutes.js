const express = require('express');
const c = require('../controllers/appointmentController');

const router = express.Router();

router.get('/', c.getAll);
router.post('/', c.book);
router.get('/:id', c.getOne);
router.patch('/:id/cancel', c.cancel);

module.exports = router;
