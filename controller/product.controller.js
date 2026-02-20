import { Product } from "../model/product.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import httpStatus from "http-status";
import { paginationHelper } from "../utils/paginationHelper.js";

const createProduct = catchAsync(async (req, res) => {
  const newProduct = await Product.create(req.body);

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
  const result = await Product.findById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

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

export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await Product.findByIdAndDelete(id);

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
  deleteProduct,
};
