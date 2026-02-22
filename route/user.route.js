import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteOwnAccount,
} from "../controller/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.patch(
  "/update-profile",
  protect,
  upload.single("avatar"),
  updateProfile
);


router.post("/change-password", protect, changePassword);
router.delete("/delete-account", protect, deleteOwnAccount);

export default router;
