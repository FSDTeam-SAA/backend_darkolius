import dotenv from "dotenv";
import mongoose from "mongoose";
import { paymentInfo } from "../model/payment.model.js";
import { Subscription } from "../model/subscription.model.js";
import { User } from "../model/user.model.js";
import { Cart } from "../model/cart.model.js";
import Stripe from "stripe";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

const makeOrderId = () =>
  `PFC-${Math.floor(1000 + Math.random() * 9000)}${Date.now()
    .toString()
    .slice(-3)}`;

export const createPayment = async (req, res) => {
  const {
    userId,
    price,
    subscriptionId,
    billingPeriod,
    paymentMethod,
    useTestStripe,
    personalTrainingSessions,
    serviceType: rawServiceType,
  } = req.body;

  const ptSessionsRaw = Number(personalTrainingSessions);
  const ptSessions =
    Number.isFinite(ptSessionsRaw) && ptSessionsRaw > 0
      ? Math.floor(ptSessionsRaw)
      : 0;

  const normalizedServiceType = (() => {
    if (typeof rawServiceType === "string" && rawServiceType.trim()) {
      return rawServiceType.trim().toLowerCase();
    }
    if (ptSessions > 0) return "personal training";
    return null;
  })();

  if (!price || Number(price) <= 0) {
    return res.status(400).json({ error: "Valid price is required." });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe is not configured." });
  }

  const tokenUserId = req.user?._id?.toString?.();
  const incomingUserId = userId?.toString?.();
  const resolvedUserId = tokenUserId || incomingUserId || null;
  const normalizedUserId = mongoose.isValidObjectId(resolvedUserId)
    ? resolvedUserId
    : null;
  const normalizedSubscriptionId = mongoose.isValidObjectId(subscriptionId)
    ? subscriptionId
    : null;
  const normalizedPaymentMethod =
    paymentMethod === "stripe" || paymentMethod === "card"
      ? paymentMethod
      : "card";

  const hasSubscription = Boolean(subscriptionId && billingPeriod);
  if (
    (subscriptionId && !billingPeriod) ||
    (!subscriptionId && billingPeriod)
  ) {
    return res.status(400).json({
      error:
        "Subscription payment must include both subscriptionId and billingPeriod.",
    });
  }

  try {
    if (hasSubscription) {
      if (!normalizedSubscriptionId) {
        return res.status(400).json({ error: "Invalid subscriptionId." });
      }

      // For subscription payments, verify the subscription exists
      const subscription = await Subscription.findById(normalizedSubscriptionId);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription plan not found." });
      }

      // Verify price matches the selected billing period
      const expectedPrice =
        billingPeriod === "yearly"
          ? subscription.priceYearly
          : subscription.priceMonthly;
      if (Math.abs(price - expectedPrice) > 0.01) {
        return res
          .status(400)
          .json({ error: "Price mismatch with subscription plan." });
      }
    }

    // Create metadata
    const metadata = {};
    if (normalizedUserId) metadata.userId = `${normalizedUserId}`;

    if (hasSubscription) {
      metadata.subscriptionId = `${normalizedSubscriptionId}`;
      metadata.billingPeriod = `${billingPeriod}`;
    }
    metadata.paymentMethod = normalizedPaymentMethod;

    const paymentIntentPayload = {
      amount: Math.round(Number(price) * 100),
      currency: "usd",
      metadata,
    };

    // Test-mode fast path for mobile: confirms with Stripe's test card method.
    if (useTestStripe === true) {
      paymentIntentPayload.payment_method = "pm_card_visa";
      paymentIntentPayload.confirm = true;
      paymentIntentPayload.automatic_payment_methods = { enabled: false };
    } else {
      paymentIntentPayload.automatic_payment_methods = { enabled: true };
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentPayload,
    );

    let purchaseItems = [];
    if (!hasSubscription && normalizedUserId) {
      const cart = await Cart.findOne({ user: normalizedUserId }).populate("items.product");
      if (cart?.items?.length) {
        purchaseItems = cart.items.map((item) => ({
          productId: item.product?._id,
          name: item.product?.name || "Product",
          imageUrl: item.product?.image?.[0]?.url || "",
          unitPrice: Number(item.product?.price || 0),
          quantity: Number(item.quantity || 1),
        }));
      }
    }

    await paymentInfo.create({
      userId: normalizedUserId,
      subscriptionId: hasSubscription ? normalizedSubscriptionId : null,
      price: Number(price),
      orderId: makeOrderId(),
      items: purchaseItems,
      transactionId: paymentIntent.id,
      paymentStatus: "pending",
      paymentMethod: normalizedPaymentMethod,
      billingPeriod: hasSubscription ? billingPeriod : null,
      personalTrainingSessions: ptSessions,
      serviceType: normalizedServiceType,
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      message: "PaymentIntent created.",
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Internal server error." });
    console.log(error);
  }
};

export const confirmPayment = async (req, res) => {
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({ error: "Missing paymentIntentId" });
  }

  try {
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return res.status(404).json({ error: "PaymentIntent not found" });
    }

    // Check final status
    if (paymentIntent.status !== "succeeded") {
      await paymentInfo.findOneAndUpdate(
        { transactionId: paymentIntentId },
        { paymentStatus: "failed" },
      );

      return res.status(400).json({
        error: "Payment did not succeed",
        status: paymentIntent.status,
      });
    }

    // Update database
    const paymentRecord = await paymentInfo.findOne({
      transactionId: paymentIntentId,
    });

    if (!paymentRecord) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    // Update payment record
    await paymentInfo.findOneAndUpdate(
      { transactionId: paymentIntentId },
      {
        paymentStatus: "complete",
      },
      { new: true },
    );

    // Handle subscription payment
    if (paymentRecord.subscriptionId) {
      const user = await User.findById(paymentRecord.userId);
      if (user && user.role === "user") {
        const subscription = await Subscription.findById(
          paymentRecord.subscriptionId,
        );
        if (subscription) {
          await Subscription.findByIdAndUpdate(paymentRecord.subscriptionId, {
            paymentStatus: "paid",
          });
        }
      }
    } else if (paymentRecord.userId) {
      await Cart.findOneAndUpdate(
        { user: paymentRecord.userId },
        { $set: { items: [] } },
      );
    }

    return res.status(200).json({
      success: true,
      message: "Payment confirmed",
      paymentIntentId,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: "Internal server error",
      stripeError: error?.message,
    });
  }
};

export const getMyPurchaseHistory = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const payments = await paymentInfo
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const pendingOrders = payments.filter((p) => p.paymentStatus === "pending").length;
    const completed = payments.filter((p) => p.paymentStatus === "complete");
    const hasActivePlan = completed.some((p) => Boolean(p.subscriptionId));
    const lastPurchaseAt = completed.length ? completed[0].createdAt : null;

    const serviceTitleFromType = (svc) => {
      const v = (svc || "").toLowerCase();
      if (v.includes("personal training")) return "Personal Training";
      if (v.includes("online coaching") || v.includes("coaching")) {
        return "Online Coaching";
      }
      if (v.includes("training plan")) return "Training Plan";
      return null;
    };

    const purchases = completed.flatMap((payment) => {
      if (!payment.items?.length) {
        const svcTitle = serviceTitleFromType(payment.serviceType);
        return [
          {
            orderId: payment.orderId || payment.transactionId || "N/A",
            title:
              svcTitle ||
              (payment.subscriptionId ? "Subscription Plan" : "Purchase"),
            serviceType: payment.serviceType || null,
            price: Number(payment.price || 0),
            imageUrl: "",
            purchasedAt: payment.createdAt,
          },
        ];
      }

      return payment.items.map((item) => ({
        orderId: payment.orderId || payment.transactionId || "N/A",
        title: item.name || "Product",
        serviceType: payment.serviceType || null,
        price: Number(item.unitPrice || 0) * Number(item.quantity || 1),
        imageUrl: item.imageUrl || "",
        purchasedAt: payment.createdAt,
      }));
    });

    return res.status(200).json({
      success: true,
      message: "Purchase history retrieved successfully",
      data: {
        pendingOrders,
        hasActivePlan,
        lastPurchaseAt,
        purchases,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const getMyMembershipSummary = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const latestMembershipPayment = await paymentInfo
      .findOne({
        userId,
        subscriptionId: { $ne: null },
        paymentStatus: "complete",
      })
      .sort({ createdAt: -1 })
      .populate("subscriptionId")
      .lean();

    if (!latestMembershipPayment) {
      return res.status(200).json({
        success: true,
        message: "Membership summary retrieved successfully",
        data: {
          hasActiveMembership: false,
        },
      });
    }

    const startedAt = new Date(latestMembershipPayment.createdAt);
    const renewalDate = new Date(startedAt);
    if (latestMembershipPayment.billingPeriod === "yearly") {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    }

    const subscription = latestMembershipPayment.subscriptionId || {};

    return res.status(200).json({
      success: true,
      message: "Membership summary retrieved successfully",
      data: {
        hasActiveMembership: true,
        planName: subscription.name || "Subscription Plan",
        price: Number(latestMembershipPayment.price || 0),
        billingPeriod: latestMembershipPayment.billingPeriod || "monthly",
        renewalDate,
        paymentMethod: latestMembershipPayment.paymentMethod || "Card",
        paymentStatus: latestMembershipPayment.paymentStatus || "complete",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const getMyPersonalTraining = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const latest = await paymentInfo
      .findOne({
        userId,
        paymentStatus: "complete",
        personalTrainingSessions: { $gt: 0 },
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!latest) {
      return res.status(200).json({
        success: true,
        message: "No active personal training package",
        data: {
          sessions: 0,
          sessionsCompleted: 0,
          scheduledDates: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Personal training summary retrieved",
      data: {
        paymentId: latest._id,
        sessions: latest.personalTrainingSessions || 0,
        sessionsCompleted: latest.personalTrainingSessionsCompleted || 0,
        scheduledDates: latest.personalTrainingScheduledDates || [],
        purchasedAt: latest.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const listAllPersonalTrainingPackages = async (req, res) => {
  try {
    const { page: pageRaw, limit: limitRaw, search, status } = req.query;
    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 20));

    const baseMatch = {
      paymentStatus: "complete",
      personalTrainingSessions: { $gt: 0 },
    };

    const aggregation = [
      { $match: baseMatch },
      { $sort: { createdAt: -1 } },
      {
        // Keep only the latest PT package per user
        $group: {
          _id: "$userId",
          paymentId: { $first: "$_id" },
          sessions: { $first: "$personalTrainingSessions" },
          sessionsCompleted: {
            $first: { $ifNull: ["$personalTrainingSessionsCompleted", 0] },
          },
          scheduledDates: {
            $first: { $ifNull: ["$personalTrainingScheduledDates", []] },
          },
          purchasedAt: { $first: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          paymentId: 1,
          sessions: 1,
          sessionsCompleted: 1,
          sessionsRemaining: {
            $max: [0, { $subtract: ["$sessions", "$sessionsCompleted"] }],
          },
          scheduledDates: 1,
          purchasedAt: 1,
          userName: "$user.name",
          userEmail: "$user.email",
          userAvatar: "$user.avatar.url",
        },
      },
    ];

    if (typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      aggregation.push({
        $match: {
          $or: [{ userName: regex }, { userEmail: regex }],
        },
      });
    }

    if (status === "active") {
      aggregation.push({ $match: { sessionsRemaining: { $gt: 0 } } });
    } else if (status === "completed") {
      aggregation.push({ $match: { sessionsRemaining: { $lte: 0 } } });
    }

    const totalAggregation = [...aggregation, { $count: "total" }];
    const totalResult = await paymentInfo.aggregate(totalAggregation);
    const total = totalResult[0]?.total || 0;

    aggregation.push({ $skip: (page - 1) * limit }, { $limit: limit });
    const items = await paymentInfo.aggregate(aggregation);

    return res.status(200).json({
      success: true,
      message: "Personal training packages retrieved",
      meta: { page, limit, total },
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const completePersonalTrainingSession = async (req, res) => {
  try {
    const { paymentId, userId, delta } = req.body;
    const step = Number(delta) === -1 ? -1 : 1;

    let target = null;
    if (paymentId && mongoose.isValidObjectId(paymentId)) {
      target = await paymentInfo.findOne({
        _id: paymentId,
        paymentStatus: "complete",
        personalTrainingSessions: { $gt: 0 },
      });
    } else if (userId && mongoose.isValidObjectId(userId)) {
      target = await paymentInfo
        .findOne({
          userId,
          paymentStatus: "complete",
          personalTrainingSessions: { $gt: 0 },
        })
        .sort({ createdAt: -1 });
    } else {
      return res.status(400).json({
        success: false,
        error: "Either paymentId or userId is required.",
      });
    }

    if (!target) {
      return res.status(404).json({
        success: false,
        error: "No active personal training package found.",
      });
    }

    const current = target.personalTrainingSessionsCompleted || 0;
    const next = Math.min(
      target.personalTrainingSessions,
      Math.max(0, current + step),
    );

    if (next === current) {
      return res.status(200).json({
        success: true,
        message: step > 0 ? "All sessions already completed." : "Already at zero.",
        data: {
          paymentId: target._id,
          sessions: target.personalTrainingSessions,
          sessionsCompleted: current,
          sessionsRemaining: target.personalTrainingSessions - current,
        },
      });
    }

    target.personalTrainingSessionsCompleted = next;
    await target.save();

    return res.status(200).json({
      success: true,
      message: step > 0 ? "Session marked completed." : "Session removed.",
      data: {
        paymentId: target._id,
        sessions: target.personalTrainingSessions,
        sessionsCompleted: target.personalTrainingSessionsCompleted,
        sessionsRemaining:
          target.personalTrainingSessions -
          target.personalTrainingSessionsCompleted,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const setPersonalTrainingDates = async (req, res) => {
  try {
    const { userId, dates } = req.body;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, error: "Valid userId is required" });
    }
    if (!Array.isArray(dates)) {
      return res.status(400).json({ success: false, error: "dates must be an array of ISO date strings" });
    }

    const parsedDates = dates
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));

    const latest = await paymentInfo
      .findOne({
        userId,
        paymentStatus: "complete",
        personalTrainingSessions: { $gt: 0 },
      })
      .sort({ createdAt: -1 });

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: "No active personal training package found for this user",
      });
    }

    latest.personalTrainingScheduledDates = parsedDates;
    await latest.save();

    return res.status(200).json({
      success: true,
      message: "Personal training dates updated",
      data: {
        paymentId: latest._id,
        scheduledDates: latest.personalTrainingScheduledDates,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};

export const getPaymentConfig = async (req, res) => {
  try {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
    if (!publishableKey) {
      return res.status(500).json({
        success: false,
        error: "Stripe publishable key is not configured.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { publishableKey },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error?.message,
    });
  }
};
