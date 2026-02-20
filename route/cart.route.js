import express from "express";
import { CartController } from "../controller/cart.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/add", protect, CartController.addToCart);
router.get("/", protect, CartController.getCart);
router.patch(
  "/update-quantity",
  protect,
  CartController.updateCartItemQuantity,
);
router.delete("/remove-item", protect, CartController.removeCartItem);
router.delete("/clear", protect, CartController.clearCart);

export const CartRoute = router;
