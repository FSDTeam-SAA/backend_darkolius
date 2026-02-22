import { Attendance } from "../model/attendance.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

const monthBounds = (year, month) => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
};

const fmtDateKey = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = `${dt.getMonth() + 1}`.padStart(2, "0");
  const day = `${dt.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const createAttendance = catchAsync(async (req, res) => {
  const { userId, visitDate, entryTime, exitTime } = req.body;

  const attendance = await Attendance.create({
    userId,
    visitDate: visitDate || entryTime || new Date(),
    entryTime: entryTime || new Date(),
    exitTime: exitTime || null,
  });

  return sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Attendance created successfully",
    data: attendance,
  });
});

export const getMyAttendance = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  const now = new Date();
  const qYear = Number(req.query.year) || now.getFullYear();
  const qMonth = Number(req.query.month) || now.getMonth() + 1;

  const { start, end } = monthBounds(qYear, qMonth);

  const allRecords = await Attendance.find({ userId }).sort({ visitDate: -1 }).lean();
  const monthRecords = await Attendance.find({
    userId,
    visitDate: { $gte: start, $lt: end },
  })
    .sort({ visitDate: 1, entryTime: 1 })
    .lean();

  const totalVisits = allRecords.length;
  const avgDuration =
    totalVisits > 0
      ? Math.round(
          allRecords.reduce((sum, r) => sum + Number(r.durationMinutes || 0), 0) /
            totalVisits,
        )
      : 0;
  const lastVisitAt = allRecords.length ? allRecords[0].visitDate : null;

  const recordsByDate = new Map();
  for (const rec of monthRecords) {
    const key = fmtDateKey(rec.visitDate);
    if (!recordsByDate.has(key)) {
      recordsByDate.set(key, []);
    }
    recordsByDate.get(key).push(rec);
  }

  const attendedDays = [...recordsByDate.keys()].map((k) => Number(k.split("-")[2]));

  const daysInMonth = new Date(qYear, qMonth, 0).getDate();
  const todayDay =
    now.getFullYear() === qYear && now.getMonth() + 1 === qMonth ? now.getDate() : daysInMonth;
  const missedDays = [];
  for (let d = 1; d <= todayDay; d++) {
    if (!attendedDays.includes(d)) missedDays.push(d);
  }

  const dayDetails = [...recordsByDate.entries()].map(([date, recs]) => {
    const firstEntry = recs[0]?.entryTime || null;
    const lastExit = recs[recs.length - 1]?.exitTime || null;
    const durationMinutes = recs.reduce(
      (sum, r) => sum + Number(r.durationMinutes || 0),
      0,
    );
    return {
      date,
      entryTime: firstEntry,
      exitTime: lastExit,
      durationMinutes,
    };
  });

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attendance retrieved successfully",
    data: {
      totalVisits,
      averageStayMinutes: avgDuration,
      lastVisitAt,
      year: qYear,
      month: qMonth,
      attendedDays,
      missedDays,
      dayDetails,
    },
  });
});
