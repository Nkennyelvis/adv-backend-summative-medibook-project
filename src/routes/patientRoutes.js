const express = require('express');
const c = require('../controllers/patientController');

const router = express.Router();

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);
router.get('/:id/appointments', c.getAppointments);

module.exports = router;
