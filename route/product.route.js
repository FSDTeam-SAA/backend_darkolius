import express from "express";
import { ProductController } from "../controller/product.controller.js";
import upload from "../middleware/multer.middleware.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/create-product",
  protect,
  isAdmin,
  upload.single("image"),
  ProductController.createProduct,
);
router.get("/all", ProductController.getAllProducts);
router.get("/:id", ProductController.getProductById);
router.patch(
  "/:id",
  protect,
  isAdmin,
  upload.single("image"),
  ProductController.updateProduct,
);
router.delete("/:id/image", protect, isAdmin, ProductController.deleteProductImage);
router.delete("/:id", protect, isAdmin, ProductController.deleteProduct);

export const ProductRoute = router;
