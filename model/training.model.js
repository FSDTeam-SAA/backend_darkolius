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
    },
    healthProfile: {
      currentWeight: { type: String },
      targetWeight: { type: String },
      recentWeightChanges: { type: String },
      bodyType: { type: String },
      currentHeight: { type: String },
      sleepPatterns: { type: String },
      appetiteHunger: { type: String },
      typicalDailyMeals: { type: String },
      waterFluidIntake: { type: String },
      surgicalHistory: { type: String },
      currentPhysicalPains: { type: String },
      digestionGutHealth: { type: String },
      supplementsCurrentlyUsed: { type: String },
    },

  },
  {
    timestamps: true,
  },
);

export const Training = mongoose.model("training", trainingSchema);
