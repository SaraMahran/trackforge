import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import {
  calcDailyStreak,
  calcWeeklyStreak,
  currentWeekCompletedDays,
  Checkin,
} from "@/lib/streaks";

interface Goals {
  minimum_days: number;
  target_days: number;
}

const TODAY = new Date().toISOString().split("T")[0];

export default function Dashboard() {
  const { user, isAdmin, signOut } = useAuth();
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [goals, setGoals] = useState<Goals>({ minimum_days: 3, target_days: 5 });
  const [todayChecked, setTodayChecked] = useState(false);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [draftGoals, setDraftGoals] = useState<Goals>({ minimum_days: 3, target_days: 5 });
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    // Load checkins
    const { data: checkinData } = await supabase
      .from("daily_checkins")
      .select("date, completed")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    const mapped = (checkinData ?? []) as Checkin[];
    setCheckins(mapped);
    setTodayChecked(mapped.some((c) => c.date === TODAY && c.completed));

    // Derive total points from DB count (avoids 1000-row limit)
    const { count } = await supabase
      .from("daily_checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("completed", true);
    setTotalPoints(count ?? 0);

    // Load goals
    const { data: goalData } = await supabase
      .from("user_goals")
      .select("minimum_days, target_days")
      .eq("user_id", user.id)
      .maybeSingle();

    if (goalData) {
      setGoals(goalData);
      setDraftGoals(goalData);
    }
  }

  async function handleCheckin() {
    if (!user || loadingCheckin) return;
    setLoadingCheckin(true);

    const alreadyChecked = checkins.some((c) => c.date === TODAY);

    if (alreadyChecked) {
      // Toggle off
      await supabase
        .from("daily_checkins")
        .update({ completed: !todayChecked })
        .eq("user_id", user.id)
        .eq("date", TODAY);
    } else {
      // Insert
      await supabase.from("daily_checkins").insert({
        user_id: user.id,
        date: TODAY,
        completed: true,
      });
    }

    await loadData();
    setLoadingCheckin(false);
  }

  async function handleSaveGoals() {
    if (!user) return;
    setGoalsError(null);

    if (draftGoals.minimum_days < 1 || draftGoals.target_days < 1) {
      setGoalsError("Goals must be at least 1 day.");
      return;
    }
    if (draftGoals.minimum_days > 7 || draftGoals.target_days > 7) {
      setGoalsError("Goals cannot exceed 7 days.");
      return;
    }
    if (draftGoals.minimum_days > draftGoals.target_days) {
      setGoalsError("Minimum days cannot exceed target days.");
      return;
    }

    setSavingGoals(true);
    const { error } = await supabase.from("user_goals").upsert({
      user_id: user.id,
      minimum_days: draftGoals.minimum_days,
      target_days: draftGoals.target_days,
    });

    if (error) {
      setGoalsError("Could not save goals. Please check your input.");
    } else {
      setGoals(draftGoals);
      setEditingGoals(false);
    }
    setSavingGoals(false);
  }

  const dailyStreak = calcDailyStreak(checkins);
  const weeklyStreak = calcWeeklyStreak(checkins, goals.minimum_days);
  const weekDays = currentWeekCompletedDays(checkins);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          Track<span className="text-primary">Forge</span>
        </h1>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <a
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </a>
          )}
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10 space-y-8">
        {/* Today's check-in */}
        <section>
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Today · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          <button
            onClick={handleCheckin}
            disabled={loadingCheckin}
            className={`w-full py-4 rounded-lg border text-sm font-medium transition-all ${
              todayChecked
                ? "bg-primary/10 border-primary text-primary"
                : "bg-surface border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {loadingCheckin
              ? "Saving…"
              : todayChecked
              ? "✓ Checked in today"
              : "Mark today as complete"}
          </button>
        </section>

        {/* Stats */}
        <section>
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Stats</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Points"
              value={totalPoints}
              sub="1 pt / day"
              colorClass="text-points"
            />
            <StatCard
              label="Daily Streak"
              value={dailyStreak}
              sub={dailyStreak === 1 ? "day" : "days"}
              colorClass="text-streak-daily"
            />
            <StatCard
              label="Weekly Streak"
              value={weeklyStreak}
              sub={weeklyStreak === 1 ? "week" : "weeks"}
              colorClass="text-streak-weekly"
            />
          </div>
        </section>

        {/* This week progress */}
        <section>
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">This Week</h2>
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Days completed</span>
              <span className="font-medium tabular-nums">{weekDays} / 7</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minimum goal</span>
              <span className="font-medium tabular-nums">{goals.minimum_days} days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target goal</span>
              <span className="font-medium tabular-nums">{goals.target_days} days</span>
            </div>
            {/* Progress bar */}
            <div className="pt-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((weekDays / goals.target_days) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>0</span>
                <span className="text-streak-daily">min {goals.minimum_days}</span>
                <span className="text-primary">target {goals.target_days}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Goals config */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider">Weekly Goals</h2>
            {!editingGoals && (
              <button
                onClick={() => { setEditingGoals(true); setGoalsError(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {editingGoals ? (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Minimum days / week
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={draftGoals.minimum_days}
                    onChange={(e) =>
                      setDraftGoals((g) => ({ ...g, minimum_days: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded bg-input border border-border text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Target days / week
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={draftGoals.target_days}
                    onChange={(e) =>
                      setDraftGoals((g) => ({ ...g, target_days: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded bg-input border border-border text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {goalsError && <p className="text-sm text-destructive">{goalsError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleSaveGoals}
                  disabled={savingGoals}
                  className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingGoals ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditingGoals(false); setDraftGoals(goals); setGoalsError(null); }}
                  className="px-4 py-2 rounded bg-muted text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Minimum: <span className="text-foreground font-medium">{goals.minimum_days} days</span>
                {" · "}
                Target: <span className="text-foreground font-medium">{goals.target_days} days</span>
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
