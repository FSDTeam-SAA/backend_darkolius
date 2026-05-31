import express from "express";
import {
  createPayment,
  confirmPayment,
  getMyPurchaseHistory,
  getMyMembershipSummary,
  getPaymentConfig,
  getMyPersonalTraining,
  setPersonalTrainingDates,
  listAllPersonalTrainingPackages,
  completePersonalTrainingSession,
} from "../controller/payment.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// Create Payment
router.post("/create-payment", protect, createPayment);
router.get("/config", getPaymentConfig);

// Capture Payment
router.post("/confirm-payment", protect, confirmPayment);
router.get("/history", protect, getMyPurchaseHistory);
router.get("/membership-summary", protect, getMyMembershipSummary);

// Personal Training
router.get("/personal-training/me", protect, getMyPersonalTraining);
router.get(
  "/personal-training/all",
  protect,
  restrictTo("admin", "coach"),
  listAllPersonalTrainingPackages,
);
router.post(
  "/personal-training/set-dates",
  protect,
  restrictTo("admin", "coach"),
  setPersonalTrainingDates,
);
router.post(
  "/personal-training/complete-session",
  protect,
  restrictTo("admin", "coach"),
  completePersonalTrainingSession,
);

export default router;
