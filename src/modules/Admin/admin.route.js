const express = require('express');
const { auth } = require('../../middlewares/auth')
const { addAdminController, allAdminController, editAdminController, deleteAdminController, suspendAdminController, activateAdminController } = require('./admin.controller');
const router = express.Router();

router.post('/add', auth(['admin', 'hr']), addAdminController);
router.put('/edit/:userId', auth(['admin', 'sub-admin']), editAdminController);
router.get('/all', auth(['admin', 'sub-admin']), allAdminController);
router.delete('/:userId', auth(['admin', 'sub-admin']), deleteAdminController);
router.patch('/suspend/:userId', auth(['admin', 'sub-admin']), suspendAdminController);
router.patch('/activate/:userId', auth(['admin', 'sub-admin']), activateAdminController);

module.exports = router;
