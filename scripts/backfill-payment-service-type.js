/*
 * One-off backfill: populate `serviceType` on paymentInfo records created before
 * the field existed. Safe to re-run — only updates records where serviceType is
 * still null/undefined.
 *
 * Run with:
 *   node scripts/backfill-payment-service-type.js
 *   node scripts/backfill-payment-service-type.js --dry-run
 */

import "dotenv/config";
import mongoose from "mongoose";

import { paymentInfo } from "../model/payment.model.js";
import { Subscription } from "../model/subscription.model.js";

const DRY_RUN = process.argv.includes("--dry-run");

const inferServiceType = (payment, subscriptionName) => {
  // 1. Personal Training is unambiguous if sessions were stored.
  if ((payment.personalTrainingSessions || 0) > 0) {
    return "personal training";
  }

  // 2. Try to read from related subscription name.
  const candidates = [
    subscriptionName,
    payment.items?.[0]?.name,
    payment.notes,
    payment.title,
  ];

  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const value = raw.toLowerCase();
    if (value.includes("personal training")) return "personal training";
    if (value.includes("online coaching")) return "online coaching";
    if (value.includes("training plan")) return "training plan";
  }

  return null;
};

const run = async () => {
  const uri = process.env.MONGO_DB_URL;
  if (!uri) {
    console.error("MONGO_DB_URL is not set in environment.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB. Dry run: ${DRY_RUN}`);

  const candidates = await paymentInfo
    .find({
      $or: [
        { serviceType: { $exists: false } },
        { serviceType: null },
        { serviceType: "" },
      ],
    })
    .populate("subscriptionId", "name")
    .lean();

  console.log(`Found ${candidates.length} payment record(s) missing serviceType.`);

  let updated = 0;
  let skipped = 0;

  for (const payment of candidates) {
    const subscriptionName = payment.subscriptionId?.name || null;
    const inferred = inferServiceType(payment, subscriptionName);

    if (!inferred) {
      skipped += 1;
      continue;
    }

    console.log(
      `${DRY_RUN ? "[dry] " : ""}${payment._id}  →  ${inferred}` +
        (subscriptionName ? `  (sub: ${subscriptionName})` : ""),
    );

    if (!DRY_RUN) {
      await paymentInfo.updateOne(
        { _id: payment._id },
        { $set: { serviceType: inferred } },
      );
    }
    updated += 1;
  }

  console.log("---");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (could not infer): ${skipped}`);
  if (skipped > 0) {
    console.log(
      "Skipped records had no subscription, no items, and no PT sessions — leaving as-is.",
    );
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
