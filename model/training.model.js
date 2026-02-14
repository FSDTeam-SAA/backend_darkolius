import mongoose from "mongoose";

const trainingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    name: { type: String },
    reps: { type: String },
    rest: { type: String },
    weight: { type: String },
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

export const Training = mongoose.model("training", trainingSchema);
