import express from "express";

import {
  createTraining,
  getAllTrainings,
  getMyTrainings,
  getSingleTraining,
  updateTraining,
  deleteTraining,
  getMyTrainingsByDate,
  getTodayTrainings,
} from "../controller/training.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();


router.post("/", protect, upload.single("image"), createTraining);

router.get("/all", protect, isAdmin, getAllTrainings);

router.get("/me", protect, getMyTrainings);

router.get("/today", protect, getTodayTrainings);

router.get("/filter", protect, getMyTrainingsByDate);

router.get("/:id", protect, getSingleTraining);

router.patch("/:id", protect, updateTraining);

router.delete("/:id", protect, deleteTraining);


export default router;
