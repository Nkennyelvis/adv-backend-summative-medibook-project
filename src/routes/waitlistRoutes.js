const express = require('express');
const c = require('../controllers/appointmentController');

const router = express.Router();

router.get('/', c.getWaitlist);
router.post('/', c.joinWaitlist);
router.delete('/', c.leaveWaitlist);

module.exports = router;
