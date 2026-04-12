const Transaction = require("../modules/Transaction/transaction.model");
const bookingModel = require("../modules/Booking/booking.model");
const serviceModel = require("../modules/Service/service.model");


const flutterwaveWebhook = async (req, res) => {
  try {
    // ✅ verify webhook
    if (req.headers["verif-hash"] !== process.env.FLW_SECRET_HASH) {
      return res.status(401).end();
    }

    const payload = req.body;

    if (payload.event !== "charge.completed") {
      return res.status(200).end();
    }

    const payment = payload.data;

    if (payment.status !== "successful") {
      return res.status(200).end();
    }

    // ✅ find transaction
    const transaction = await Transaction.findOne({ tx_ref: payment.tx_ref });
    if (!transaction) return res.status(200).end();

    // ✅ prevent duplicate execution
    if (transaction.status === "successful") {
      return res.status(200).end();
    }

    // ✅ SECURITY: verify amount
    if (Number(payment.amount) !== Number(transaction.grossAmount)) {
      transaction.status = "failed";
      await transaction.save();
      return res.status(200).end();
    }

    // ✅ update transaction
    transaction.status = "successful";
    transaction.transaction_id = payment.id;
    transaction.payment_method = payment.payment_type;
    transaction.bank_name = payment.bank_name || null;
    transaction.meta = payment;

    const gross = Number(transaction.grossAmount);
    transaction.commission = gross * 0.1;
    transaction.netPayout = gross - transaction.commission;

    // ✅ CREATE BOOKING AFTER PAYMENT
    if (transaction.booking_data) {
      const data = transaction.booking_data;

      const serviceData = await serviceModel.findById(data.service);
      if (!serviceData) return res.status(200).end();

      const bookingPayload = {
        user: data.user,
        service: data.service,
        provider: data.provider,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        servicePrice: data.servicePrice,
        totalPrice: data.totalPrice,
        addons: data.addons || [],

        isOneTime: data.isOneTime,

        transaction: transaction._id,
        paymentMethod: "digital-payment",
        paymentStatus: "paid",
        status: "approved", // ✅ important
      };

      // ✅ safe session logic
      bookingPayload.sessionLeft = data.isOneTime
        ? 1
        : serviceData?.pass?.noOfSessions || 1;

      // ✅ safe expiry logic
      bookingPayload.expireDate = new Date(
        new Date(data.date).getTime() +
          (data.isOneTime
            ? 1
            : serviceData?.pass?.validity || 1) *
            86400000
      );

      const booking = await bookingModel.create(bookingPayload);

      transaction.booking = booking._id;
    }

    await transaction.save();

    return res.status(200).end();
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).end();
  }
};


module.exports = flutterwaveWebhook;