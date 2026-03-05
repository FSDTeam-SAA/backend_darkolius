import AppError from "../errors/AppError.js";
import { MembershipFreeze } from "../model/membershipFreeze.model.js";
import { paymentInfo } from "../model/payment.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

const resolveLatestActiveMembership = async (userId) => {
  const latestMembershipPayment = await paymentInfo
    .findOne({
      userId,
      subscriptionId: { $ne: null },
      paymentStatus: "complete",
    })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestMembershipPayment) {
    return null;
  }

  const startedAt = new Date(latestMembershipPayment.createdAt);
  const renewalDate = new Date(startedAt);
  if (latestMembershipPayment.billingPeriod === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  return {
    payment: latestMembershipPayment,
    renewalDate,
    isExpired: renewalDate.getTime() <= Date.now(),
  };
};

export const freezeMembership = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new AppError(401, "Unauthorized");
  }

  const indefinite = req.body?.indefinite === true;
  const rawEndDate = req.body?.endDate;

  if (!indefinite && !rawEndDate) {
    throw new AppError(400, "endDate is required when freeze is not indefinite.");
  }

  const membership = await resolveLatestActiveMembership(userId);
  if (!membership) {
    throw new AppError(400, "No membership found to freeze.");
  }

  if (membership.isExpired) {
    throw new AppError(400, "Membership is already expired.");
  }

  let parsedEndDate = null;
  if (!indefinite) {
    parsedEndDate = new Date(rawEndDate);
    if (Number.isNaN(parsedEndDate.getTime())) {
      throw new AppError(400, "Invalid endDate.");
    }

    const now = new Date();
    if (parsedEndDate.getTime() <= now.getTime()) {
      throw new AppError(400, "endDate must be a future date.");
    }

    if (parsedEndDate.getTime() > membership.renewalDate.getTime()) {
      throw new AppError(
        400,
        "Freeze end date cannot be after current membership renewal date.",
      );
    }
  }

  const activeFreeze = await MembershipFreeze.findOne({
    userId,
    status: "active",
  }).sort({ createdAt: -1 });

  const payload = {
    membershipPaymentId: membership.payment._id,
    freezeType: indefinite ? "indefinite" : "untilDate",
    endDate: indefinite ? null : parsedEndDate,
    startedAt: new Date(),
    status: "active",
  };

  const freezeDoc = activeFreeze
    ? await MembershipFreeze.findByIdAndUpdate(activeFreeze._id, payload, {
        new: true,
        runValidators: true,
      })
    : await MembershipFreeze.create({
        userId,
        ...payload,
      });

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: indefinite
      ? "Membership freeze is now indefinite."
      : "Membership freeze updated successfully.",
    data: {
      freezeId: freezeDoc._id,
      isFrozen: true,
      indefinite,
      endDate: freezeDoc.endDate,
      startedAt: freezeDoc.startedAt,
      membershipRenewalDate: membership.renewalDate,
    },
  });
});

export const getMyFreezeStatus = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new AppError(401, "Unauthorized");
  }

  const membership = await resolveLatestActiveMembership(userId);

  const latestFreeze = await MembershipFreeze.findOne({ userId })
    .sort({ createdAt: -1 })
    .lean();

  let isFrozen = false;
  let indefinite = false;
  let endDate = null;
  let startedAt = null;

  if (latestFreeze?.status === "active") {
    const freezeHasEndDate = Boolean(latestFreeze.endDate);
    const freezeExpired =
      freezeHasEndDate && new Date(latestFreeze.endDate).getTime() <= Date.now();

    if (freezeExpired) {
      await MembershipFreeze.findByIdAndUpdate(latestFreeze._id, {
        status: "ended",
      });
    } else {
      isFrozen = true;
      indefinite = latestFreeze.freezeType === "indefinite";
      endDate = latestFreeze.endDate || null;
      startedAt = latestFreeze.startedAt || null;
    }
  }

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Freeze status retrieved successfully",
    data: {
      isFrozen,
      indefinite,
      endDate,
      startedAt,
      hasActiveMembership: Boolean(membership && !membership.isExpired),
      membershipRenewalDate: membership?.renewalDate || null,
    },
  });
});
