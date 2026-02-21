import dotenv from "dotenv";
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
  const { userId, price, subscriptionId, billingPeriod, useTestStripe } =
    req.body;

  if (!price || Number(price) <= 0) {
    return res.status(400).json({ error: "Valid price is required." });
  }

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
      // For subscription payments, verify the subscription exists
      const subscription = await Subscription.findById(subscriptionId);

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
    if (userId) metadata.userId = `${userId}`;

    if (hasSubscription) {
      metadata.subscriptionId = `${subscriptionId}`;
      metadata.billingPeriod = `${billingPeriod}`;
    }

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
    if (!hasSubscription && userId) {
      const cart = await Cart.findOne({ user: userId }).populate("items.product");
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
      userId: userId || null,
      subscriptionId: hasSubscription ? subscriptionId : null,
      price: Number(price),
      orderId: makeOrderId(),
      items: purchaseItems,
      transactionId: paymentIntent.id,
      paymentStatus: "pending",
      billingPeriod: hasSubscription ? billingPeriod : null,
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      message: "PaymentIntent created.",
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
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

    const purchases = completed.flatMap((payment) => {
      if (!payment.items?.length) {
        return [
          {
            orderId: payment.orderId || payment.transactionId || "N/A",
            title: payment.subscriptionId ? "Subscription Plan" : "Purchase",
            price: Number(payment.price || 0),
            imageUrl: "",
            purchasedAt: payment.createdAt,
          },
        ];
      }

      return payment.items.map((item) => ({
        orderId: payment.orderId || payment.transactionId || "N/A",
        title: item.name || "Product",
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
