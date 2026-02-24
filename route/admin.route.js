import express from "express";
import { getUsers, deleteUser } from "../controller/admin.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/users", protect, isAdmin, getUsers);
router.delete("/users/:id", protect, isAdmin, deleteUser);

export default router;
