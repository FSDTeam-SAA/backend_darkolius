import express from "express";

import authRoute from "../route/auth.route.js";
import userRoute from "../route/user.route.js";
import adminRoute from "../route/admin.route.js";
import subscriptionRoute from "../route/subscription.route.js";
import paymentRoute from "../route/payment.route.js";
import nutrationRoute from "../route/nutartion.route.js";
import trainingRoute from "../route/training.route.js";
import { ProductRoute } from "../route/product.route.js";
import { CartRoute } from "../route/cart.route.js";

const router = express.Router();

// Mounting the routes
router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/admin", adminRoute);
router.use("/nutration", nutrationRoute);
router.use("/training", trainingRoute);

// New features (kept separate from existing APIs)
router.use("/subscription", subscriptionRoute);

router.use("/payment", paymentRoute);
router.use("/product", ProductRoute);
router.use("/cart", CartRoute);

export default router;
