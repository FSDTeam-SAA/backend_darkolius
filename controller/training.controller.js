import mongoose from "mongoose";
import httpStatus from "http-status";

import { Training } from "../model/training.model.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/commonMethod.js";

import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import AppError from "../errors/AppError.js";

const parseImagePayload = (imagePayload) => {
  if (!imagePayload) {
    return undefined;
  }

  if (typeof imagePayload === "string") {
    try {
      const parsed = JSON.parse(imagePayload);
      if (parsed && typeof parsed === "object") {
        return {
          url: parsed.url || null,
          public_id: parsed.public_id || null,
        };
      }
    } catch {
      return {
        url: imagePayload,
        public_id: null,
      };
    }
  }

  if (typeof imagePayload === "object") {
    return {
      url: imagePayload.url || null,
      public_id: imagePayload.public_id || null,
    };
  }

  return undefined;
};


/**
 * CREATE TRAINING
 */
export const createTraining = catchAsync(async (req, res) => {
  const authUserId = req.user?._id?.toString?.();
  const authRole = req.user?.role;

  const {
    userId: bodyUserId,
    name,
    reps,
    rest,
    weight,
    date,
    image,
    healthProfile,
  } = req.body;

  const targetUserId = authRole === "admin" && bodyUserId ? bodyUserId : authUserId;

  // validation
  if (!name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Exercise name is required");
  }

  if (!date) {
    throw new AppError(httpStatus.BAD_REQUEST, "Date is required");
  }

  // verify user exists
  if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user id");
  }

  const userExists = await User.exists({ _id: targetUserId });

  if (!userExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  
  let uploadedImage;
  if (req.file) {
    const result = await uploadOnCloudinary(req.file.buffer, {
      folder: "darkolius/training",
    });

    uploadedImage = {
      url: result.secure_url,
      public_id: result.public_id,
    };
  }

  // safe object creation
  const trainingData = {
    userId: targetUserId,
    name,
    reps: reps || null,
    rest: rest || null,
    weight: weight || null,
    date: new Date(date),
    image: uploadedImage || parseImagePayload(image),
    healthProfile: healthProfile || undefined,
  };

  const training = await Training.create(trainingData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Training created successfully",
    data: training,
  });
});


/**
 * GET ALL TRAININGS (ADMIN)
 */
export const getAllTrainings = catchAsync(async (req, res) => {
  const trainings = await Training.find()
    .populate("userId", "name email")
    .sort({ date: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Trainings fetched successfully",
    data: trainings,
  });
});


/**
 * GET MY TRAININGS
 */
export const getMyTrainings = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const trainings = await Training.find({ userId })
    .sort({ date: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My trainings fetched successfully",
    data: trainings,
  });
});


/**
 * GET SINGLE TRAINING
 */
export const getSingleTraining = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid training id");
  }

  const training = await Training.findOne({
    _id: id,
    userId,
  });

  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, "Training not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Training fetched successfully",
    data: training,
  });
});


/**
 * UPDATE TRAINING
 */
export const updateTraining = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid training id");
  }

  const training = await Training.findOneAndUpdate(
    { _id: id, userId },
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, "Training not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Training updated successfully",
    data: training,
  });
});


/**
 * DELETE TRAINING
 */
export const deleteTraining = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid training id");
  }

  const training = await Training.findOneAndDelete({
    _id: id,
    userId,
  });

  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, "Training not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Training deleted successfully",
    data: null,
  });
});


/**
 * GET MY TRAININGS BY DATE FILTER
 * query:
 * ?startDate=2026-02-01&endDate=2026-02-28
 */
export const getMyTrainingsByDate = catchAsync(async (req, res) => {
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

  const trainings = await Training.find(filter)
    .sort({ date: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Trainings fetched successfully",
    data: trainings,
  });
});


/**
 * GET TODAY TRAININGS
 */
export const getTodayTrainings = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const trainings = await Training.find({
    userId,
    date: {
      $gte: start,
      $lte: end,
    },
  }).sort({ createdAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Today's trainings fetched successfully",
    meta: {
      serverDate: new Date().toISOString(),
    },
    data: trainings,
  });
});
