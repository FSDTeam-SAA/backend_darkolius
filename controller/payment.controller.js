import dotenv from "dotenv";
import { paymentInfo } from "../model/payment.model.js";
import { Subscription } from "../model/subscription.model.js";
import { User } from "../model/user.model.js";
import Stripe from "stripe";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export const createPayment = async (req, res) => {
  const { userId, price, subscriptionId, billingPeriod } = req.body;

  if (!price) {
    return res.status(400).json({ error: "Price and type are required." });
  }

  if (!billingPeriod || !subscriptionId) {
    return res
      .status(400)
      .json({ error: "Subscription and billing period are required." });
  }

  try {
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

    // Create metadata
    const metadata = { userId };

    if (subscriptionId) {
      metadata.subscriptionId = subscriptionId;
      metadata.billingPeriod = billingPeriod;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    await paymentInfo.create({
      userId,
      subscriptionId: subscriptionId || null,
      price,
      transactionId: paymentIntent.id,
      paymentStatus: "pending",
      billingPeriod: billingPeriod || null,
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
