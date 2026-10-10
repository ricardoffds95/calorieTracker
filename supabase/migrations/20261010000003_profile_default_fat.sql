-- Default fat goal 67 g matches the "maintain" preset (30/40/30) at 2000 kcal.
alter table public.profiles alter column goal_fat set default 67;

-- Fix profiles still on the untouched old defaults.
update public.profiles
set goal_fat = 67
where goal_calories = 2000 and goal_protein = 150 and goal_carbs = 200 and goal_fat = 65 and mode = 'maintain';
