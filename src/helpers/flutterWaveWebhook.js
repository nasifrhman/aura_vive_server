const Transaction = require("../modules/Transaction/transaction.model");
const bookingModel = require("../modules/Booking/booking.model");
const serviceModel = require("../modules/Service/service.model");
const userModel = require("../modules/User/user.model");

const flutterwaveWebhook = async (req, res) => {
  try {

    if (req.headers["verif-hash"] !== process.env.FLW_SECRET_HASH)
      return res.status(401).end();

    const payload = req.body;

    if (payload.event !== "charge.completed")
      return res.status(200).end();

    const payment = payload.data;

    if (payment.status !== "successful")
      return res.status(200).end();

    const transaction = await Transaction.findOne({
      tx_ref: payment.tx_ref,
    });

    if (!transaction) return res.status(200).end();

    if (transaction.booking) return res.status(200).end();

    // ======================
    // PAYMENT DATA
    // ======================
    transaction.transaction_id = payment.id;
    transaction.payment_method = payment.payment_type || null;
    transaction.bank_name =
      payment.bank_name ||
      payment.card?.issuer ||
      null;

    transaction.meta = payment;

    // fallback partner snapshot
    if (!transaction.account_name || !transaction.account_number) {
      const partnerData = await userModel.findById(transaction.partner);

      if (partnerData) {
        transaction.account_name = partnerData.account_name;
        transaction.account_number = partnerData.account_number;
      }
    }

    // ======================
    // CREATE BOOKING
    // ======================
    if (transaction.booking_data) {

      const data = transaction.booking_data;

      const serviceData = await serviceModel.findById(data.service);

      if (!serviceData) return res.status(200).end();

      const sessions = serviceData?.pass?.noOfSessions || 1;
      const validity = serviceData?.pass?.validity || 1;

      const bookingPayload = {
        ...data,
        transaction: transaction._id,
        paymentStatus: "paid",
        status: "pending",
      };

      if (data.isOneTime) {
        bookingPayload.sessionLeft = 1;
        bookingPayload.expireDate =
          new Date(new Date(data.date).getTime() + 86400000);
      } else {
        bookingPayload.sessionLeft = sessions;
        bookingPayload.expireDate =
          new Date(new Date(data.date).getTime() + validity * 86400000);
      }

      const booking = await bookingModel.create(bookingPayload);

      transaction.booking = booking._id;
    }

    // ======================
    // FINAL STATUS UPDATE
    // ======================
    transaction.payment_status = "successful";

    await transaction.save();

    return res.status(200).end();

  } catch (error) {
    console.log(error);
    return res.status(200).end();
  }
};

module.exports = flutterwaveWebhook;