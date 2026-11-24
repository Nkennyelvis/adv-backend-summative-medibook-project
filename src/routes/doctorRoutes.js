const express = require('express');
const c = require('../controllers/doctorController');

const router = express.Router();

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);
router.get('/:id/stats', c.stats);
router.get('/:id/availability', c.availability);

module.exports = router;
