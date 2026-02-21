import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      trim: true,
      default: "Admin",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      trim: true,
      default: "View Details",
    },
    heading: {
      type: String,
      trim: true,
      default: "ATTENTION MEMBERS:",
    },
    bullet: {
      type: String,
      trim: true,
      default: "Update",
    },
    body: {
      type: String,
      trim: true,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Notification = mongoose.model("Notification", notificationSchema);
