ALTER TABLE public.user_goals
  ADD CONSTRAINT goals_range CHECK (
    minimum_days BETWEEN 1 AND 7
    AND target_days BETWEEN 1 AND 7
    AND minimum_days <= target_days
  );