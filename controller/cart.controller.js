import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import httpStatus from "http-status";
import { Cart } from "../model/cart.model.js";

const addToCart = catchAsync(async (req, res) => {
  const user = req.user._id;
  const { productId, size, flavour, quantity } = req.body;
  const qty = Number(quantity) > 0 ? Number(quantity) : 1;

  let cart = await Cart.findOne({ user });

  if (cart) {
    // Match same product + same size + same flavour so different variants are separate lines
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        (item.size || "") === (size || "") &&
        (item.flavour || "") === (flavour || ""),
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += qty;
    } else {
      cart.items.push({ product: productId, size, flavour, quantity: qty });
    }
    await cart.save();
  } else {
    cart = await Cart.create({
      user,
      items: [{ product: productId, size, flavour, quantity: qty }],
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product added to cart successfully",
    data: cart,
  });
});

const getCart = catchAsync(async (req, res) => {
  const user = req.user._id;

  const result = await Cart.findOne({ user }).populate("items.product");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart retrieved successfully",
    data: result,
  });
});

const updateCartItemQuantity = catchAsync(async (req, res) => {
  const user = req.user._id;
  const { productId, action } = req.body; // action: 'increment' or 'decrement'

  const cart = await Cart.findOne({ user });
  const item = cart.items.find((i) => i.product.toString() === productId);

  if (item) {
    if (action === "increment") {
      item.quantity += 1;
    } else if (action === "decrement" && item.quantity > 1) {
      item.quantity -= 1;
    }
    await cart.save();
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart updated",
    data: cart,
  });
});

const removeCartItem = catchAsync(async (req, res) => {
  const user = req.user._id;
  const { productId } = req.body;

  const result = await Cart.findOneAndUpdate(
    { user },
    { $pull: { items: { product: productId } } },
    { new: true },
  ).populate("items.product");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Item removed from cart",
    data: result,
  });
});

const clearCart = catchAsync(async (req, res) => {
  const user = req.user._id;

  const result = await Cart.findOneAndUpdate(
    { user },
    { $set: { items: [] } },
    { new: true },
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cart cleared successfully",
    data: result,
  });
});

export const CartController = {
  addToCart,
  getCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};
