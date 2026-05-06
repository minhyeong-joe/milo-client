import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { ImageSourcePropType } from "react-native";

export type HomeIconName = ComponentProps<typeof Ionicons>["name"];
export type RoutineKind = "meal" | "diaper" | "sleep";
export type MealType = "breastfeed" | "breastMilk" | "formula" | "solid";
export type SleepType = "nap" | "nighttime";
export type DiaperType = "wet" | "dirty" | "both" | "dry";
export type DiaperColor = "green" | "brown" | "yellow" | "black";
export type PreferredVolumeUnit = "ml" | "oz";

export type BabyProfile = {
  name: string;
  birthdate: string;
};

export type MealEvent = {
  amountMl?: number;            // For bottle feedings. UI responsible for converting to preferred unit if needed.
  durationMinutes?: number;     // For breastfeeding sessions
  amountBowl?: number;          // For solid feedings, representing number of bowls or servings (1/4, 1/2, 3/4, 1)
  amountGrams?: number;         // For solid feedings measured by weight. Separate from bowl units.
  breastSide?: "left" | "right"; // For breastfeeding sessions, indicating which side was used
  id: string;
  kind: "meal";
  syncStatus?: "pending" | "failed";
  notes?: string;
  time: string;
  type: MealType;
};

export type SleepEvent = {
  endTime?: string;
  id: string;
  kind: "sleep";
  syncStatus?: "pending" | "failed";
  notes?: string;
  startTime: string;
  type: SleepType;
};

export type DiaperEvent = {
  color?: DiaperColor;
  id: string;
  kind: "diaper";
  syncStatus?: "pending" | "failed";
  notes?: string;
  time: string;
  type: DiaperType;
};

export type RoutineStyle = {
  accentColor: string;
  backgroundColor: string;
  icon?: HomeIconName;
  imageSource?: ImageSourcePropType;
  label: string;
};

export type RoutineEvent = MealEvent | SleepEvent | DiaperEvent;

export type RoutineDay = {
  date: string;
  summary: DailyRoutineSummary;
  timeline: RoutineEvent[];
};

export type RoutineConfig = {
  preferredVolumeUnit: PreferredVolumeUnit;
  quickActions: Record<RoutineKind, RoutineStyle>;
  mealTypes: Record<MealType, string>;
  sleepTypes: Record<SleepType, string>;
  diaperTypes: Record<DiaperType, string>;
  diaperColors: Record<DiaperColor, { label: string; swatch: string }>;
};

export type DailyRoutineSummary = {
  diapers: {
    byType: Record<DiaperType, number>;
    totalChanges: number;
  };
  meals: {
    byType: Record<MealType, { count: number; totalMinutes?: number; totalAmountMl?: number; totalBowls?: number; totalGrams?: number }>;
    totalCount: number;
  };
  sleep: {
    byType: Record<SleepType, { count: number; totalMinutes: number }>;
    totalMinutes: number;
    totalSessions: number;
  };
};

export const routineConfig = {
  preferredVolumeUnit: "ml",
  quickActions: {
    meal: {
      label: "Meal",
      imageSource: require("@/assets/images/meal_icon.png"),
      accentColor: "#7C4DFF",
      backgroundColor: "#EFE5FF",
    },
    diaper: {
      label: "Diaper",
      imageSource: require("@/assets/images/diaper_icon.png"),
      accentColor: "#2FB86E",
      backgroundColor: "#DFF7E8",
    },
    sleep: {
      label: "Sleep",
      icon: "moon",
      accentColor: "#326BC7",
      backgroundColor: "#DDEEFF",
    },
  },
  mealTypes: {
    breastfeed: "Breastfeed",
    breastMilk: "Bottle (Breast Milk)",
    formula: "Bottle (Formula)",
    solid: "Solid Food",
  },
  sleepTypes: {
    nap: "Nap",
    nighttime: "Night Sleep",
  },
  diaperTypes: {
    wet: "Wet",
    dirty: "Dirty",
    both: "Both",
    dry: "Dry",
  },
  diaperColors: {
    green: { label: "Green", swatch: "#6AA84F" },
    brown: { label: "Brown", swatch: "#8B5A2B" },
    yellow: { label: "Yellow", swatch: "#E7B72F" },
    black: { label: "Black", swatch: "#2C2C2C" },
  },
} satisfies RoutineConfig;
