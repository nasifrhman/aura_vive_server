const axios = require("axios");
const Transaction = require("./transaction.model");
const catchAsync = require("../../helpers/catchAsync");
const bookingModel = require("../Booking/booking.model");
const { getUserById } = require("../Auth/auth.service");



const bookController = catchAsync(async (req, res) => {
  const userId = req.User._id;

  const {
    service,
    provider,
    date,
    isOneTime,
    servicePrice,
    totalPrice,
    addons,
    startTime,
    endTime,
  } = req.body;

  const user = await getUserById(userId);
  const { email, name } = user;


  const tx_ref = "txn_" + Date.now();

  // ✅ STEP 1: Create Booking FIRST
  const booking = await bookingModel.create({
    user: userId,
    service,
    provider,
    date,
    isOneTime,
    servicePrice,
    totalPrice,
    addons,
    startTime,
    endTime,
    status: "pending",
  });

  // ✅ STEP 2: Create Transaction
  const transaction = await Transaction.create({
    tx_ref,
    user: userId,
    booking: booking._id,
    service,
    provider,
    grossAmount: totalPrice,
    currency: "NGN",
    status: "pending",
  });

  // ✅ STEP 3: Initialize Payment
  const response = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref,
      amount: totalPrice,
      currency: "NGN",
      redirect_url: process.env.FLW_SUCCESS_URL,
      payment_options: "card,banktransfer",
      customer: { email, name },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  res.json({
    paymentLink: response.data.data.link,
    tx_ref,
  });
});



const cancelBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.User._id;

  const booking = await bookingModel.findById(bookingId).populate("transaction");
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.user.toString() !== userId) {
    return res.status(403).json({ error: "Not allowed" });
  }

  // Only pending or upcoming bookings can be canceled
  if (booking.status === "completed")
    return res.status(400).json({ error: "Cannot cancel completed booking" });

  // Update booking
  booking.status = "cancelled";
  booking.paymentStatus =
    booking.paymentStatus === "paid" ? "refunded" : booking.paymentStatus;

  await booking.save();

  // Refund payment if digital payment
  if (booking.paymentStatus === "refunded" && booking.transaction?.transaction_id) {
    try {
      await axios.post(
        `https://api.flutterwave.com/v3/transactions/${booking.transaction.transaction_id}/refund`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          },
        }
      );
    } catch (err) {
      console.error("Refund failed:", err.response?.data || err.message);
    }
  }

  // Update transaction status
  if (booking.transaction) {
    booking.transaction.status = "cancelled";
    booking.transaction.paymentStatus = booking.paymentStatus;
    await booking.transaction.save();
  }

  res.json({ message: "Booking cancelled successfully" });
});



const initializePayment = async (req, res) => {
  try {
    const { amount, email, name } = req.body;
    const tx_ref = "txn_" + Date.now();

    // Save initial transaction as pending
    await Transaction.create({
      tx_ref,
      user_email: email,
      amount,
      currency: "NGN",
      status: "pending",
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency: "NGN",
        redirect_url: process.env.FLW_SUCCESS_URL,
        payment_options: "card,banktransfer",
        customer: { email, name },
        customizations: {
          title: "My App Payment",
          description: "Subscription payment",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      paymentLink: response.data.data.link,
      tx_ref,
    });
  } catch (error) {
    console.log("Flutterwave Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
};

const verifyPayment = async (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id)
    return res.send("Transaction missing");

  try {

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      }
    );

    const payment = response.data.data;

    await Transaction.findOneAndUpdate(
      { tx_ref: payment.tx_ref },
      {
        status: payment.status,
        transaction_id: payment.id,
      }
    );

    res.send("✅ Payment Processing...");
  } catch (error) {
    res.status(500).send("Verification failed");
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  bookController,
  cancelBooking
};