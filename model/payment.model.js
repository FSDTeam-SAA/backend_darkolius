import mongoose from "mongoose";

const paymentInfoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    subscriptionId: {
      type: mongoose.Types.ObjectId,
      ref: "Subscription",
    },
    price: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["complete", "pending", "failed"],
      default: "pending",
    },
    seasonId: { type: String },
    transactionId: { type: String },
    paymentMethodNonce: { type: String },
    paymentMethod: { type: String },
    billingPeriod: {
      type: String,
      enum: ["monthly", "yearly"],
    },
  },
  {
    timestamps: true,
  },
);

export const paymentInfo = mongoose.model("paymentInfo", paymentInfoSchema);
