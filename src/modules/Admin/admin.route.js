const express = require('express');
const { auth } = require('../../middlewares/auth')
const { addAdminController, allAdminController, editAdminController, deleteAdminController } = require('./admin.controller');
const router = express.Router();

router.post('/add', auth(['admin', 'hr']), addAdminController);
router.put('/edit/:userId', auth(['admin', 'sub-admin']), editAdminController);
router.get('/all', auth(['admin', 'sub-admin']), allAdminController);
router.delete('/:userId', auth(['admin', 'sub-admin']), deleteAdminController);

module.exports = router;