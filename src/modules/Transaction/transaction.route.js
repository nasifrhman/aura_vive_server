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
  payoutStatusUpdateController,
  allPayoutController,
  partnerMonthlySummaryController,
  holdPayoutController,
  doCompletePayoutController,
  partnerMonthlyCompletedPayoutController,
  earningController,
} = require("./transaction.controller");
const { auth } = require("../../middlewares/auth");
const { default: status } = require("http-status");

const router = express.Router();


router.patch("/cancel/:bookingId", auth(['user']), cancelBooking);
router.patch("/hold", holdPayoutController);
router.patch("/complete", doCompletePayoutController);
router.post("/book", auth(['user']), bookController)
router.post("/", initializePayment);
router.get("/all-transaction", allTransactionController);
router.get("/earning", earningController);
router.get("/all-payout", allPayoutController);
router.get("/pending-payout", partnerMonthlySummaryController);
router.get("/complete-payout", partnerMonthlyCompletedPayoutController);

module.exports = router;
