import express from "express";
import { ProductController } from "../controller/product.controller.js";

const router = express.Router();

router.post("/create-product", ProductController.createProduct);
router.get("/all", ProductController.getAllProducts);
router.get("/:id", ProductController.getProductById);
router.patch("/:id", ProductController.updateProduct);
router.delete("/:id", ProductController.deleteProduct);

export const ProductRoute = router;
