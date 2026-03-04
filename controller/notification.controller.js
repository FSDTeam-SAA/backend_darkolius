import mongoose from "mongoose";
import httpStatus from "http-status";

import { Notification } from "../model/notification.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { getSocket } from "../utils/socket.js";

const emitNotificationEvent = (eventName, notification, extra = {}) => {
  const io = getSocket();
  if (!io || !notification) return;

  const userId = notification.userId ? notification.userId.toString() : null;
  const payload =
    typeof notification.toObject === "function"
      ? notification.toObject()
      : notification;

  if (userId) {
    io.to(`notifications_${userId}`).emit(eventName, { ...payload, ...extra });
    return;
  }

  io.to("notifications_global").emit(eventName, { ...payload, ...extra });
};

export const createNotification = catchAsync(async (req, res) => {
  const {
    userId,
    title,
    message,
    details,
    heading,
    bullet,
    body,
  } = req.body;

  if (!message) {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is required");
  }

  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid userId");
  }

  const notification = await Notification.create({
    userId: userId || null,
    title,
    message,
    details,
    heading,
    bullet,
    body,
  });

  emitNotificationEvent("notification:new", notification);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Notification created successfully",
    data: notification,
  });
});

export const getAllNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find()
    .populate("userId", "name email")
    .sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: notifications,
  });
});

export const getMyNotifications = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const notifications = await Notification.find({
    $or: [{ userId }, { userId: null }],
  }).sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My notifications fetched successfully",
    data: notifications,
  });
});

export const markNotificationRead = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid notification id");
  }

  const notification = await Notification.findOne({
    _id: id,
    $or: [{ userId }, { userId: null }],
  });

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  notification.isRead = true;
  await notification.save();
  emitNotificationEvent("notification:updated", notification);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
});

export const deleteNotification = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid notification id");
  }

  const notification = await Notification.findByIdAndDelete(id);

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  emitNotificationEvent("notification:deleted", notification, { _id: id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted successfully",
    data: null,
  });
});
