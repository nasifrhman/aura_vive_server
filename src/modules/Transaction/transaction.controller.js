const axios = require("axios");
const Transaction = require("./transaction.model");
const catchAsync = require("../../helpers/catchAsync");
const bookingModel = require("../Booking/booking.model");
const { getUserById } = require("../Auth/auth.service");
const userModel = require("../User/user.model");
const { getAllTransactions, getPendingPayoutService, getcompletePayoutService, payoutStatusUpdateService } = require("./transaction.service");
const { default: status } = require("http-status");
const response = require("../../helpers/response");
const generate4DigitPin = require("../../helpers/generatepin");




const bookController = catchAsync(async (req, res) => {

  const {
    service,
    partner,
    date,
    isOneTime,
    servicePrice,
    totalPrice,
    addons,
  } = req.body;
  console.log(req.body)

  const userId = req.User._id;
  const user = await getUserById(userId);

  const tx_ref = `txn_${Date.now()}_${userId}`;

  // 🔹 Commission Calculation
  const commissionRate = 0.10; // 10%
  const grossAmount = Number(totalPrice);
  const commission = grossAmount * commissionRate;
  const netAmount = grossAmount - commission;

  // 🔹 Get partner bank info
  const partnerData = await userModel.findById(partner);

  if (!partnerData) {
    return res.status(400).json({
      message: "Partner not found",
    });
  }
  
    const pin = generate4DigitPin();

  // ✅ Create Transaction
  await Transaction.create({
    tx_ref,
    user: userId,
    partner,
    service,

    user_email: user.email,

    amount: grossAmount,
    currency: "USD",

    gross_amount: grossAmount,
    commission,
    net_amount: netAmount,

    // account_name: partnerData.account_name || "",
    // account_number: partnerData.account_number || "",

    payout_status: "pending", // until service completed

    status: "pending",

    booking_data: {
      user: userId,
      service,
      provider: partner,
      date,
      isOneTime,
      servicePrice,
      totalPrice,
      addons,
      pin
    },
  });

  // 🔥 Flutterwave Init
  const response = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref,
      amount: grossAmount,
      currency: "USD",
      redirect_url: process.env.FLW_SUCCESS_URL,

      payment_options: "card,banktransfer",

      customer: {
        email: user.email,
        name: user.fullName,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      },
    }
  );

  res.json({
    paymentLink: response.data.data.link,
    tx_ref,
  });
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
      transaction_id: payment.id,
      status:
        payment.status === "successful"
          ? "successful"
          : "failed",
    }
  );

  res.send("Payment verification complete");
};


const allTransactionController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,

    payment_method: req.query.payment_method || undefined,
    search: req.query.search || undefined,
  };

  const transactions = await getAllTransactions(option);

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Transaction fetched successfully",
      data: transactions,
    })
  );
});




const pendingPayoutController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,

    status: req.query.status,
    search: req.query.search,
  };

  const transactions = await getPendingPayoutService(option);

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Transaction fetched successfully",
      data: transactions,
    })
  );
});

const completePayoutController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,

    status: req.query.status,
    search: req.query.search,
  };

  const transactions = await getcompletePayoutService(option);

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Transaction fetched successfully",
      data: transactions,
    })
  );
});



const payoutStatusUpdateController = catchAsync(async (req, res) => {

  const { partnerId, month, year, status } = req.body;

  const result = await payoutStatusUpdateService({
    partnerId,
    month,
    year,
    status
  });

  return res.status(200).json(
    response({
      status: "success",
      message: "Monthly payout completed",
      data: result
    })
  );
});



const cancelBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.User._id;

  const booking = await bookingModel.findById(bookingId).populate("transaction");
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (!booking.user.equals(userId)) return res.status(403).json({ error: "Not allowed" });

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



module.exports = {
  initializePayment,
  verifyPayment,
  bookController,
  cancelBooking,
  allTransactionController,
  pendingPayoutController,
  payoutStatusUpdateController,
  completePayoutController
};