import AppError from "../errors/AppError.js";
import { Subscription } from "../model/subscription.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

export const createSubscription = catchAsync(async (req, res) => {
  const { planType, name, benefits, priceMonthly, priceYearly, isActive } = req.body;

  if (planType && !["initial", "training"].includes(planType)) {
    throw new AppError(400, "Invalid plan type");
  }

  const subscription = await Subscription.create({
    planType: planType || "initial",
    name,
    benefits,
    priceMonthly,
    priceYearly,
    isActive,
  });

  return sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Subscription created successfully",
    data: subscription,
  });
});

export const getSubscriptions = catchAsync(async (req, res) => {
  const { activeOnly, planType } = req.query;

  const query = {};
  if (activeOnly === "true") {
    query.isActive = true;
  }

  if (planType) {
    if (!["initial", "training"].includes(String(planType))) {
      throw new AppError(400, "Invalid plan type");
    }

    const trainingPattern = /training|coach|session|personal/i;

    if (planType === "initial") {
      query.$or = [
        { planType: "initial" },
        {
          $and: [
            { planType: { $exists: false } },
            { name: { $not: trainingPattern } },
          ],
        },
      ];
    } else {
      query.$or = [
        { planType: "training" },
        {
          $and: [
            { planType: { $exists: false } },
            { name: { $regex: trainingPattern } },
          ],
        },
      ];
    }
  }

  const subscriptions = await Subscription.find(query).sort({ createdAt: -1 });

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscriptions retrieved successfully",
    data: subscriptions,
  });
});

export const getSubscriptionById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const subscription = await Subscription.findById(id);
  if (!subscription) {
    throw new AppError(404, "Subscription not found");
  }

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription retrieved successfully",
    data: subscription,
  });
});

export const updateSubscription = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { planType } = req.body;

  if (planType && !["initial", "training"].includes(String(planType))) {
    throw new AppError(400, "Invalid plan type");
  }

  const subscription = await Subscription.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!subscription) {
    throw new AppError(404, "Subscription not found");
  }

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription updated successfully",
    data: subscription,
  });
});

export const deleteSubscription = catchAsync(async (req, res) => {
  const { id } = req.params;

  const subscription = await Subscription.findByIdAndDelete(id);

  if (!subscription) {
    throw new AppError(404, "Subscription not found");
  }

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription deleted successfully",
    data: subscription,
  });
});
