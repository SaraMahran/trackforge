import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  calcPoints,
  calcDailyStreak,
  calcWeeklyStreak,
  Checkin,
} from "@/lib/streaks";

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  minimum_days: number;
  points: number;
  dailyStreak: number;
  weeklyStreak: number;
}

export default function AdminDashboard() {
  const { isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);

  // Admin access is enforced by AdminRoute in App.tsx — no client-side redirect needed

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  async function loadAll() {
    setFetching(true);

    // Fetch all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email");

    if (!profiles) { setFetching(false); return; }

    // Fetch all user goals
    const { data: goals } = await supabase
      .from("user_goals")
      .select("user_id, minimum_days");

    const goalMap = new Map((goals ?? []).map((g) => [g.user_id, g.minimum_days]));

    // Fetch all checkins
    const { data: checkins } = await supabase
      .from("daily_checkins")
      .select("user_id, date, completed");

    const checkinMap = new Map<string, Checkin[]>();
    for (const c of checkins ?? []) {
      if (!checkinMap.has(c.user_id)) checkinMap.set(c.user_id, []);
      checkinMap.get(c.user_id)!.push({ date: c.date, completed: c.completed });
    }

    const result: UserRow[] = profiles.map((p) => {
      const userCheckins = checkinMap.get(p.id) ?? [];
      const minDays = goalMap.get(p.id) ?? 3;
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        minimum_days: minDays,
        points: calcPoints(userCheckins),
        dailyStreak: calcDailyStreak(userCheckins),
        weeklyStreak: calcWeeklyStreak(userCheckins, minDays),
      };
    });

    // Sort by points descending
    result.sort((a, b) => b.points - a.points);
    setRows(result);
    setFetching(false);
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          Track<span className="text-primary">Forge</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">Admin</span>
        </h1>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </a>
          <button
            onClick={signOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium text-foreground">
            Users <span className="text-muted-foreground">({rows.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">Read-only view · sorted by points</p>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  #
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  User
                </th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Points
                </th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Daily Streak
                </th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Weekly Streak
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No users found.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{row.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-points font-bold tabular-nums">
                    {row.points}
                  </td>
                  <td className="px-4 py-3 text-right text-streak-daily font-medium tabular-nums">
                    {row.dailyStreak}d
                  </td>
                  <td className="px-4 py-3 text-right text-streak-weekly font-medium tabular-nums">
                    {row.weeklyStreak}w
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
