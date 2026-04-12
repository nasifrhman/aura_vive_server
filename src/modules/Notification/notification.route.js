const express = require("express");
const { addNotification, readNotification, adminNotification } = require("./notification.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();


router.post("/",  auth(['admin']), addNotification);
router.get("/notification-adminend",  auth(['admin']), adminNotification);
router.put("/read/:id",  auth(['user', 'business', 'admin']), readNotification);

module.exports = router;