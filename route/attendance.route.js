import express from "express";
import { createAttendance, getMyAttendance } from "../controller/attendance.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", protect, getMyAttendance);
router.post("/", protect, isAdmin, createAttendance);

export default router;
