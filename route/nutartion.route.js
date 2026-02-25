import express from "express";

import {
  createNutration,
  getAllNutrations,
  getMyNutrations,
  getSingleNutration,
  updateNutration,
  deleteNutration,
  getMyNutrationsByDate,
  getTodayNutrations,
} from "../controller/nutration.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

router.post("/", protect, upload.single("image"), createNutration);

router.get("/all", protect, isAdmin, getAllNutrations);

router.get("/me", protect, getMyNutrations);

router.get("/today", protect, getTodayNutrations);

router.get("/filter", protect, getMyNutrationsByDate);

router.get("/:id", protect, getSingleNutration);

router.patch("/:id", protect, updateNutration);

router.delete("/:id", protect, deleteNutration);

export default router;
