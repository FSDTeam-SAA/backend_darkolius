import mongoose from "mongoose";

const nutrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    name: { type: String },
    time: { type: String },
    meal: { type: String },
    protein: { type: String },
    carbs: { type: String },
    fat: { type: String },
    cal: { type: String },
    date: {
      type: Date
    },
        image:{
        url: {
            type: String
        },
        public_id:{
            type: String
        }
    }

  },
  {
    timestamps: true,
  },
);

export const Nutration = mongoose.model("nutration", nutrationSchema);
