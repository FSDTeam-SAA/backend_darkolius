import { User } from "../model/user.model.js";
import sendResponse from "../utils/sendResponse.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";

export const getUsers = catchAsync(async (req, res) => {
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);

  const skip = (page - 1) * limit;

  const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });

  const users = await User.find({ role: { $ne: "admin" } })
    .select("-__v -password -refreshToken")
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalUsers / limit);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users retrieved successfully",
    data: {
      users,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
});

export const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError(400, "User ID is required");
  }

  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError(404, "User not found");
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User deleted successfully",
  });
});
