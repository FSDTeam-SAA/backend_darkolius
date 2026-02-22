import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    visitDate: {
      type: Date,
      required: true,
      index: true,
    },
    entryTime: {
      type: Date,
      required: true,
    },
    exitTime: {
      type: Date,
    },
    durationMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

attendanceSchema.pre("save", function (next) {
  if (this.entryTime && this.exitTime) {
    const diffMs = new Date(this.exitTime).getTime() - new Date(this.entryTime).getTime();
    this.durationMinutes = Math.max(0, Math.round(diffMs / 60000));
  }
  next();
});

export const Attendance = mongoose.model("Attendance", attendanceSchema);
