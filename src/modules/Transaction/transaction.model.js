// src/modules/Transaction/transaction.model.js

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    tx_ref: { type: String, unique: true },
    transaction_id: String,
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: false },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    grossAmount: Number,
    commission: Number,
    netPayout: Number,
    currency: String,
    status: {
      type: String,
      enum: ["pending", "successful", "failed", "cancelled", "hold", 'completed'],
      default: "pending",
    },

    payment_method: String,
    bankName: String,
    accountNumber: String,
    accountName: String,

    meta: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);