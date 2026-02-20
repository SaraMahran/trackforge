// All streak and points calculations are done client-side.

export interface Checkin {
  date: string; // "YYYY-MM-DD"
  completed: boolean;
}

/** Total points = count of completed check-ins (1 per day) */
export function calcPoints(checkins: Checkin[]): number {
  return checkins.filter((c) => c.completed).length;
}

/** Daily streak: consecutive days ending today (or yesterday) with completed=true */
export function calcDailyStreak(checkins: Checkin[]): number {
  const completedDates = new Set(
    checkins.filter((c) => c.completed).map((c) => c.date)
  );

  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);

  // Allow streak to include today if checked in, or start from yesterday
  while (true) {
    const dateStr = cursor.toISOString().split("T")[0];
    if (completedDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      // If today is not completed, check yesterday to preserve active streaks
      if (streak === 0 && dateStr === today.toISOString().split("T")[0]) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
  }

  return streak;
}

/** Get the ISO week string "YYYY-Www" for a date */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Weekly streak: consecutive weeks (ending last completed week or current week)
 * where the count of completed days >= minimumDays.
 */
export function calcWeeklyStreak(checkins: Checkin[], minimumDays: number): number {
  // Group completed checkins by ISO week
  const weekMap = new Map<string, number>();
  for (const c of checkins) {
    if (!c.completed) continue;
    const week = getISOWeek(new Date(c.date));
    weekMap.set(week, (weekMap.get(week) ?? 0) + 1);
  }

  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);

  while (true) {
    const week = getISOWeek(cursor);
    const count = weekMap.get(week) ?? 0;

    if (count >= minimumDays) {
      streak++;
      // Move cursor back 7 days to previous week
      cursor.setDate(cursor.getDate() - 7);
    } else {
      // Allow checking previous week if current week just started
      if (streak === 0) {
        const currentWeek = getISOWeek(today);
        if (week === currentWeek) {
          cursor.setDate(cursor.getDate() - 7);
          continue;
        }
      }
      break;
    }
  }

  return streak;
}

/** Count completed days in the current ISO week */
export function currentWeekCompletedDays(checkins: Checkin[]): number {
  const thisWeek = getISOWeek(new Date());
  return checkins.filter(
    (c) => c.completed && getISOWeek(new Date(c.date)) === thisWeek
  ).length;
}
