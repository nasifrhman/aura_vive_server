const express = require("express");
const {
  initializePayment,
  verifyPayment,
  bookController,
  cancelBooking,
  allTransactionController,
  pendingPayoutController,
  statusUpdateController,
  completeMonthlyPayoutController,
  completePayoutController,
  payoutStatusUpdateController,
  allPayoutController,
} = require("./transaction.controller");
const { auth } = require("../../middlewares/auth");
const { default: status } = require("http-status");

const router = express.Router();


router.patch("/cancel/:bookingId", auth(['user']), cancelBooking);
router.patch("/status-update", payoutStatusUpdateController);
router.post("/book", auth(['user']), bookController)
router.post("/", initializePayment);
router.get("/all-transaction", allTransactionController);
router.get("/pending-payout", pendingPayoutController);
router.get("/all-payout", allPayoutController);
router.get("/complete-payout", completePayoutController);

module.exports = router;