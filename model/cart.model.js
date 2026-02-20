import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  size: String,
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [cartItemSchema],
    subTotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

cartSchema.pre("save", async function (next) {
  // 1. Populate product prices to calculate totals
  await this.populate("items.product");

  // 2. Calculate Subtotal
  this.subTotal = this.items.reduce((acc, item) => {
    return acc + item.product.price * item.quantity;
  }, 0);

  // 3. Calculate Tax (e.g., 15%) and Shipping (e.g., $10)
  this.tax = Number((this.subTotal * 0.15).toFixed(2));
  this.shippingCost = this.subTotal > 0 ? 10 : 0;

  // 4. Calculate Final Total
  this.total = this.subTotal + this.tax + this.shippingCost;

  next();
});

export const Cart = mongoose.model("Cart", cartSchema);
