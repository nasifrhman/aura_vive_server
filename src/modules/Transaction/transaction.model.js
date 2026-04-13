const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    tx_ref: { type: String, unique: true },

    transaction_id: String,

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    user_email: String,

    amount: Number,
    currency: String,

    // status: {
    //   type: String,
    //   enum: ["pending", "successful", "failed", "refunded"],
    //   default: "pending",
    // },

    payment_method: String,
    bank_name: String,

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },

    booking_data: Object,

    meta: Object,

    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
    // account_name: String,
    // account_number: String,
    gross_amount: Number,
    commission: Number,
    net_amount: Number,
    payment_status: {
      type: String,
      enum: ["pending", "successful", "failed", "refunded"],
      default: "pending",
    },

    payout_status: {
      type: String,
      enum: ["pending", "hold", "completed"],
      default: "hold",
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);