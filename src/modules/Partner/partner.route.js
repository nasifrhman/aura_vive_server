const express = require('express');
const { pendingPartnerForApproval, detailsForAdminController, allPartnerController, suspendPartnerController, activePartnerController, giveFlagController, giveNoteController, rejectProviderController, approvePartnerController, partnerFeedbackController, aPartnerDetailsController } = require('./partner.controller');
const router = express.Router();



router.get('/admin/details/:id', detailsForAdminController);
router.get('/details/:id', aPartnerDetailsController);
router.get('/pending-forApproval', pendingPartnerForApproval);
router.get('/all', allPartnerController);
router.post('/feedback/:partnerId', partnerFeedbackController);
router.patch('/suspend/:id', suspendPartnerController);
router.patch('/active/:id', activePartnerController);
router.patch('/approve/:id', approvePartnerController);
router.patch('/give-flag/:id', giveFlagController);
router.patch('/give-note/:id', giveNoteController);
router.patch('/reject/:id', rejectProviderController);


module.exports = router;
