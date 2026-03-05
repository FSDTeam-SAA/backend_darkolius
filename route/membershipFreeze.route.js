import express from "express";
import {
  freezeMembership,
  getMyFreezeStatus,
} from "../controller/membershipFreeze.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, freezeMembership);
router.get("/status", protect, getMyFreezeStatus);

export default router;
