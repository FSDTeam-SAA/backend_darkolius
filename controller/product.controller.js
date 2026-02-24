import mongoose from "mongoose";
import httpStatus from "http-status";

import { Product } from "../model/product.model.js";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { paginationHelper } from "../utils/paginationHelper.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/commonMethod.js";

const parseNumericField = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const parseSizes = (sizePayload) => {
  if (sizePayload === undefined || sizePayload === null || sizePayload === "") {
    return [];
  }

  if (Array.isArray(sizePayload)) {
    return sizePayload
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof sizePayload === "string") {
    try {
      const parsed = JSON.parse(sizePayload);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      // Ignore parse error and fallback to comma-separated input.
    }

    return sizePayload
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const parseBodyImage = (imagePayload) => {
  if (!imagePayload) {
    return [];
  }

  let parsedPayload = imagePayload;

  if (typeof imagePayload === "string") {
    try {
      parsedPayload = JSON.parse(imagePayload);
    } catch {
      return [];
    }
  }

  const imageArray = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];

  return imageArray
    .map((image) => ({
      url: image?.url || "",
      public_id: image?.public_id || "",
    }))
    .filter((image) => image.url && image.public_id);
};

const deleteCloudinaryImages = async (images = []) => {
  const tasks = images
    .map((image) => image?.public_id)
    .filter(Boolean)
    .map((publicId) => deleteFromCloudinary(publicId));

  if (tasks.length) {
    await Promise.all(tasks);
  }
};

const createProduct = catchAsync(async (req, res) => {
  const {
    name,
    description,
    price,
    size,
    stockSell,
    stockAvailable,
    totalStock,
    image: bodyImage,
  } = req.body;

  if (!name?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Product name is required");
  }

  const numericPrice = parseNumericField(price, NaN);
  if (Number.isNaN(numericPrice)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid product price is required");
  }

  let image = parseBodyImage(bodyImage);

  if (req.file) {
    const uploadedImage = await uploadOnCloudinary(req.file.buffer, {
      folder: "darkolius/products",
    });

    image = [
      {
        url: uploadedImage.secure_url,
        public_id: uploadedImage.public_id,
      },
    ];
  }

  if (!image.length) {
    throw new AppError(httpStatus.BAD_REQUEST, "Product image is required");
  }

  const payload = {
    name: name.trim(),
    description: description?.trim?.() || "",
    price: numericPrice,
    size: parseSizes(size),
    stockSell: parseNumericField(stockSell, 0),
    stockAvailable: parseNumericField(stockAvailable, 0),
    totalStock: parseNumericField(totalStock, 0),
    image,
  };

  const newProduct = await Product.create(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product created successfully",
    data: newProduct,
  });
});

export const getAllProducts = catchAsync(async (req, res) => {
  const { searchTerm, ...paginationOptions } = req.query;
  const query = {};

  if (searchTerm) {
    query.name = { $regex: searchTerm, $options: "i" };
  }

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions);

  const sortConditions = {};
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }

  const result = await Product.find(query)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products retrieved successfully",
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  });
});

export const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid product id");
  }

  const result = await Product.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid product id");
  }

  const existingProduct = await Product.findById(id);
  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const payload = {};

  if (req.body.name !== undefined) {
    if (!String(req.body.name).trim()) {
      throw new AppError(httpStatus.BAD_REQUEST, "Product name can not be empty");
    }
    payload.name = String(req.body.name).trim();
  }

  if (req.body.description !== undefined) {
    payload.description = String(req.body.description).trim();
  }

  if (req.body.price !== undefined) {
    const numericPrice = parseNumericField(req.body.price, NaN);
    if (Number.isNaN(numericPrice)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Valid product price is required");
    }
    payload.price = numericPrice;
  }

  if (req.body.size !== undefined) {
    payload.size = parseSizes(req.body.size);
  }

  if (req.body.stockSell !== undefined) {
    payload.stockSell = parseNumericField(req.body.stockSell, 0);
  }

  if (req.body.stockAvailable !== undefined) {
    payload.stockAvailable = parseNumericField(req.body.stockAvailable, 0);
  }

  if (req.body.totalStock !== undefined) {
    payload.totalStock = parseNumericField(req.body.totalStock, 0);
  }

  if (req.body.image !== undefined) {
    payload.image = parseBodyImage(req.body.image);

    if (!payload.image.length) {
      await deleteCloudinaryImages(existingProduct.image);
    }
  }

  if (req.file) {
    const uploadedImage = await uploadOnCloudinary(req.file.buffer, {
      folder: "darkolius/products",
    });

    await deleteCloudinaryImages(existingProduct.image);

    payload.image = [
      {
        url: uploadedImage.secure_url,
        public_id: uploadedImage.public_id,
      },
    ];
  }

  const result = await Product.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

export const deleteProductImage = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid product id");
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const publicId = req.body?.publicId || req.query?.publicId;
  const targetPublicId = publicId || product.image?.[0]?.public_id;

  if (!targetPublicId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Product has no image to delete");
  }

  await deleteFromCloudinary(targetPublicId);

  product.image = (product.image || []).filter(
    (item) => item.public_id !== targetPublicId,
  );
  await product.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product image deleted successfully",
    data: product,
  });
});

export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid product id");
  }

  const result = await Product.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  await deleteCloudinaryImages(result.image);
  await Product.findByIdAndDelete(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product deleted successfully",
    data: result,
  });
});

export const ProductController = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProductImage,
  deleteProduct,
};
