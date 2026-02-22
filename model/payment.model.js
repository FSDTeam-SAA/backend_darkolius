import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Types.ObjectId,
      ref: "Product",
    },
    name: { type: String },
    imageUrl: { type: String },
    unitPrice: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false },
);

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
    orderId: { type: String },
    items: {
      type: [purchaseItemSchema],
      default: [],
    },
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
