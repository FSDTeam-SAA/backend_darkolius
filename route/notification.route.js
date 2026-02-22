import express from "express";

import {
  createNotification,
  deleteNotification,
  getAllNotifications,
  getMyNotifications,
  markNotificationRead,
} from "../controller/notification.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, isAdmin, createNotification);
router.get("/all", protect, isAdmin, getAllNotifications);
router.get("/me", protect, getMyNotifications);
router.patch("/:id/read", protect, markNotificationRead);
router.delete("/:id", protect, isAdmin, deleteNotification);

export default router;
