const express = require("express");
const {
  initializePayment,
  verifyPayment,
  bookController,
  cancelBooking,
} = require("./transaction.controller");
const { auth } = require("../../middlewares/auth");

const router = express.Router();


router.patch("/cancel/:bookingId", auth(['user']), cancelBooking);
router.post("/book", auth(['user']), bookController)
router.post("/", initializePayment);
router.get("/success", verifyPayment);

module.exports = router;