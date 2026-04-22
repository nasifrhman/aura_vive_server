const express = require("express");
const { addFeedbackController, getFeedbackController, getMyFeedbackController, replyController } = require("./feedback.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add",auth(['user']), addFeedbackController);
router.get('/my-feedback',auth(['partner']), getMyFeedbackController);
router.post("/reply",auth(['partner']), replyController);

module.exports = router;