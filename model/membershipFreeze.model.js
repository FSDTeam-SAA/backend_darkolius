import mongoose from "mongoose";

const membershipFreezeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    membershipPaymentId: {
      type: mongoose.Types.ObjectId,
      ref: "paymentInfo",
      required: true,
    },
    freezeType: {
      type: String,
      enum: ["indefinite", "untilDate"],
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "ended", "cancelled"],
      default: "active",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

membershipFreezeSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const MembershipFreeze = mongoose.model(
  "MembershipFreeze",
  membershipFreezeSchema,
);
