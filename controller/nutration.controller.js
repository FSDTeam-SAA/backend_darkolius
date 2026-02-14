import mongoose from "mongoose";
import httpStatus from "http-status";

import { Nutration } from "../model/nutration.model.js";
import { User } from "../model/user.model.js";

import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import AppError from "../errors/AppError.js";


/**
 * CREATE NUTRATION
 */
export const createNutration = catchAsync(async (req, res) => {
//   const userId = req.user._id;

  const {
    userId,
    name,
    time,
    meal,
    protein,
    carbs,
    fat,
    cal,
    date,
    image,
  } = req.body;

  // validation
  if (!name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Name is required");
  }

  if (!date) {
    throw new AppError(httpStatus.BAD_REQUEST, "Date is required");
  }

  // verify user exists
  const userExists = await User.exists({ _id: userId });

  if (!userExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // create nutration object safely
  const nutrationData = {
    userId,
    name,
    time: time || null,
    meal: meal || null,
    protein: protein || null,
    carbs: carbs || null,
    fat: fat || null,
    cal: cal || null,
    date: new Date(date),
    image: image
      ? {
          url: image.url || null,
          public_id: image.public_id || null,
        }
      : undefined,
  };

  const nutration = await Nutration.create(nutrationData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Nutration created successfully",
    data: nutration,
  });
});


/**
 * GET ALL NUTRATIONS (ADMIN or DEBUG)
 */
export const getAllNutrations = catchAsync(async (req, res) => {
  const nutrations = await Nutration.find()
    .populate("userId", "name email")
    .sort({ date: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nutrations fetched successfully",
    data: nutrations,
  });
});


/**
 * GET MY NUTRATIONS
 */
export const getMyNutrations = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const nutrations = await Nutration.find({ userId })
    .sort({ date: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My nutrations fetched successfully",
    data: nutrations,
  });
});


/**
 * GET SINGLE NUTRATION
 */
export const getSingleNutration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid nutration id");
  }

  const nutration = await Nutration.findOne({
    _id: id,
    userId,
  });

  if (!nutration) {
    throw new AppError(httpStatus.NOT_FOUND, "Nutration not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nutration fetched successfully",
    data: nutration,
  });
});


/**
 * UPDATE NUTRATION
 */
export const updateNutration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid nutration id");
  }

  const nutration = await Nutration.findOneAndUpdate(
    { _id: id, userId },
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!nutration) {
    throw new AppError(httpStatus.NOT_FOUND, "Nutration not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nutration updated successfully",
    data: nutration,
  });
});


/**
 * DELETE NUTRATION
 */
export const deleteNutration = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid nutration id");
  }

  const nutration = await Nutration.findOneAndDelete({
    _id: id,
    userId,
  });

  if (!nutration) {
    throw new AppError(httpStatus.NOT_FOUND, "Nutration not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nutration deleted successfully",
    data: null,
  });
});


/**
 * GET MY NUTRATIONS WITH DATE FILTER
 * query:
 * ?startDate=2026-02-01&endDate=2026-02-28
 */
export const getMyNutrationsByDate = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

  const filter = { userId };

  if (startDate || endDate) {
    filter.date = {};

    if (startDate) {
      filter.date.$gte = new Date(startDate);
    }

    if (endDate) {
      filter.date.$lte = new Date(endDate);
    }
  }

  const nutrations = await Nutration.find(filter)
    .sort({ date: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nutrations fetched successfully",
    data: nutrations,
  });
});


/**
 * GET TODAY NUTRATIONS
 */
export const getTodayNutrations = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const nutrations = await Nutration.find({
    userId,
    date: {
      $gte: start,
      $lte: end,
    },
  }).sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Today's nutrations fetched successfully",
    data: nutrations,
  });
});
