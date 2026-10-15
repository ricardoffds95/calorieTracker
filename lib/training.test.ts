import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BODY_ZONES,
  LEVELS,
  MUSCLES,
  ZONE_MUSCLES,
  addToWorkout,
  equipmentOf,
  exerciseImageUrl,
  filterExercises,
  moveInWorkout,
  parseWorkoutExercises,
  toggleZone,
  workoutProblem,
  zonesOf,
  type Exercise,
  type Muscle,
} from "./training";

const exercise = (id: string, name: string, primary: string[], secondary: string[] = [], equipment = "barbell", level = "beginner"): Exercise => ({
  id,
  name,
  level,
  equipment,
  category: "strength",
  primaryMuscles: primary,
  secondaryMuscles: secondary,
  instructions: ["Do it"],
  images: [`${id}/0.jpg`],
});

const all = [
  exercise("bench", "Bench Press", ["chest"], ["triceps", "shoulders"]),
  exercise("fly", "Dumbbell Fly", ["chest"], [], "dumbbell", "intermediate"),
  exercise("dip", "Bar Dip", ["triceps"], ["chest"], "body only"),
  exercise("curl", "Barbell Curl", ["biceps"], ["forearms"]),
  exercise("squat", "Back Squat", ["quadriceps"], ["glutes", "hamstrings"]),
];

describe("the body zones", () => {
  it("stand for real muscles, and every muscle of the dataset has a zone to tap", () => {
    const covered = new Set<Muscle>(BODY_ZONES.flatMap((zone) => [...ZONE_MUSCLES[zone]]));
    for (const muscle of MUSCLES) expect(covered.has(muscle), muscle).toBe(true);
    for (const zone of BODY_ZONES) for (const muscle of ZONE_MUSCLES[zone]) expect(MUSCLES).toContain(muscle);
  });

  it("toggles all the muscles of a zone together", () => {
    expect(toggleZone([], "upper-back")).toEqual(["lats", "middle back"]);
    expect(toggleZone(["lats"], "upper-back")).toEqual(["lats", "middle back"]); // only one on: all go on
    expect(toggleZone(["lats", "middle back"], "upper-back")).toEqual([]);
    expect(toggleZone(["chest"], "biceps")).toEqual(["chest", "biceps"]);
  });

  it("shares a muscle between two zones (the calves and the shin, the abs and the obliques)", () => {
    expect(zonesOf(["calves"])).toEqual(["calves", "tibialis"]);
    expect(toggleZone(["calves"], "tibialis")).toEqual([]);
    expect(toggleZone([], "gluteal")).toEqual(["glutes", "abductors"]);
  });

  it("colours the zones that have a chosen muscle", () => {
    expect(zonesOf([])).toEqual([]);
    expect(zonesOf(["abdominals"])).toEqual(["abs", "obliques"]);
    expect(zonesOf(["lats"])).toEqual(["upper-back"]);
  });
});

describe("filterExercises", () => {
  it("lists nothing until a muscle is chosen", () => {
    expect(filterExercises(all, [])).toEqual([]);
  });

  it("puts the exercises where the muscle is the main one first, then the secondary ones, each by name", () => {
    const hits = filterExercises(all, ["chest"]);
    expect(hits.map((h) => [h.exercise.id, h.secondary])).toEqual([
      ["bench", false],
      ["fly", false],
      ["dip", true],
    ]);
  });

  it("joins several muscles without repeating an exercise", () => {
    const ids = filterExercises(all, ["chest", "triceps"]).map((h) => h.exercise.id);
    expect(ids).toEqual(["dip", "bench", "fly"]); // dip has triceps as main, so it is not "secondary" any more
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters by name and by equipment", () => {
    expect(filterExercises(all, ["chest"], { query: " FLY " }).map((h) => h.exercise.id)).toEqual(["fly"]);
    expect(filterExercises(all, ["chest"], { equipment: "dumbbell" }).map((h) => h.exercise.id)).toEqual(["fly"]);
    expect(filterExercises(all, ["chest"], { equipment: null }).length).toBe(3);
  });

  it("filters by level, together with equipment", () => {
    expect(filterExercises(all, ["chest"], { level: "intermediate" }).map((h) => h.exercise.id)).toEqual(["fly"]);
    expect(filterExercises(all, ["chest"], { level: "beginner" }).map((h) => h.exercise.id)).toEqual(["bench", "dip"]);
    expect(filterExercises(all, ["chest"], { level: "beginner", equipment: "dumbbell" })).toEqual([]);
    expect(filterExercises(all, ["chest"], { level: "expert" })).toEqual([]);
    expect(filterExercises(all, ["chest"], { level: null }).length).toBe(3);
  });

  it("is stable: the same input gives the same order, and the input is not changed", () => {
    const copy = [...all];
    expect(filterExercises(all, ["chest"])).toEqual(filterExercises([...all].reverse(), ["chest"]));
    expect(all).toEqual(copy);
  });

  it("lists the equipment once, alphabetically", () => {
    expect(equipmentOf(all)).toEqual(["barbell", "body only", "dumbbell"]);
  });
});

describe("the exercises file of the app", () => {
  const file = JSON.parse(readFileSync("public/training/exercises.json", "utf8")) as Exercise[];

  it("has the exercises, with known muscles and at least one main muscle each", () => {
    expect(file.length).toBeGreaterThan(800);
    for (const e of file) {
      expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0);
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES, `${e.id}: ${m}`).toContain(m);
    }
  });

  it("only has the levels the filter offers", () => {
    for (const e of file) expect(LEVELS, e.id).toContain(e.level);
  });

  it("has distinct ids that a workout accepts, and a muscle with exercises for every zone", () => {
    expect(new Set(file.map((e) => e.id)).size).toBe(file.length);
    for (const e of file) expect(workoutProblem("Chest", [{ id: e.id, name: e.name }]), e.id).toBe("");
    for (const zone of BODY_ZONES) expect(filterExercises(file, [...ZONE_MUSCLES[zone]]).length, zone).toBeGreaterThan(0);
  });
});

describe("workouts", () => {
  const a = { id: "bench", name: "Bench Press" };
  const b = { id: "fly", name: "Dumbbell Fly" };
  const c = { id: "dip", name: "Bar Dip" };

  it("asks for a name and 1 to 50 exercises, in short words", () => {
    expect(workoutProblem("", [a])).toBe("Name required");
    expect(workoutProblem("   ", [a])).toBe("Name required");
    expect(workoutProblem("a".repeat(101), [a])).toBe("Max 100 characters");
    expect(workoutProblem("Chest", [])).toBe("Add an exercise");
    expect(workoutProblem("Chest", Array.from({ length: 51 }, (_, i) => ({ id: `e${i}`, name: `E ${i}` })))).toBe("Max 50 exercises");
    expect(workoutProblem("  Chest  ", [a])).toBe("");
  });

  it("does not take an exercise twice, and stops at 50", () => {
    expect(addToWorkout([a], b)).toEqual([a, b]);
    expect(addToWorkout([a, b], a)).toEqual([a, b]);
    const full = Array.from({ length: 50 }, (_, i) => ({ id: `e${i}`, name: `E ${i}` }));
    expect(addToWorkout(full, c)).toHaveLength(50);
  });

  it("moves an exercise up or down and stays put at the ends", () => {
    expect(moveInWorkout([a, b, c], 1, -1)).toEqual([b, a, c]);
    expect(moveInWorkout([a, b, c], 1, 1)).toEqual([a, c, b]);
    expect(moveInWorkout([a, b, c], 0, -1)).toEqual([a, b, c]);
    expect(moveInWorkout([a, b, c], 2, 1)).toEqual([a, b, c]);
    expect(moveInWorkout([a, b, c], 9, 1)).toEqual([a, b, c]);
  });

  it("reads the stored exercises, and an empty list for a corrupt value", () => {
    expect(parseWorkoutExercises([a, b])).toEqual([a, b]);
    expect(parseWorkoutExercises("nope")).toEqual([]);
    expect(parseWorkoutExercises([{ id: "", name: "x" }])).toEqual([]);
    expect(parseWorkoutExercises(null)).toEqual([]);
  });
});

describe("exerciseImageUrl", () => {
  it("points at the repository folder and escapes each part of the path", () => {
    expect(exerciseImageUrl("3_4_Sit-Up/0.jpg")).toBe("https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/3_4_Sit-Up/0.jpg");
    expect(exerciseImageUrl("Dumbbell Fly/1.jpg")).toBe("https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dumbbell%20Fly/1.jpg");
  });
});
