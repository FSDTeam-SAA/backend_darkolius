import express from "express";
import {
  createPayment,
  confirmPayment,
  getMyPurchaseHistory,
  getMyMembershipSummary,
} from "../controller/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Create Payment
router.post("/create-payment", createPayment);

// Capture Payment
router.post("/confirm-payment", confirmPayment);
router.get("/history", protect, getMyPurchaseHistory);
router.get("/membership-summary", protect, getMyMembershipSummary);

export default router;
