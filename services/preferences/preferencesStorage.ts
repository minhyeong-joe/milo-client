import type { PreferredVolumeUnit } from "@/data/homeData";
import type { TimelineTimeZoneMode } from "@/utils/timeZones";
import { getDeviceTimeZone, normalizeTimeZone } from "@/utils/timeZones";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PREFERENCES_STORAGE_KEY = "milo.preferences";
const DEFAULT_VOLUME_UNIT: PreferredVolumeUnit = "ml";
const DEFAULT_SOLID_FOOD_UNIT: PreferredSolidFoodUnit = "servings";
const DEFAULT_LENGTH_UNIT: PreferredLengthUnit = "cm";
const DEFAULT_WEIGHT_UNIT: PreferredWeightUnit = "kg";
const DEFAULT_TIMELINE_TIME_ZONE_MODE: TimelineTimeZoneMode = "baby";
const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export type PreferredSolidFoodUnit = "servings" | "grams";
export type PreferredLengthUnit = "cm" | "in";
export type PreferredWeightUnit = "kg" | "lb";
export type ThemePreference = "system" | "light" | "dark";

export type StoredPreferences = {
	preferredVolumeUnit: PreferredVolumeUnit;
	preferredSolidFoodUnit: PreferredSolidFoodUnit;
	preferredLengthUnit: PreferredLengthUnit;
	preferredWeightUnit: PreferredWeightUnit;
	themePreference: ThemePreference;
	timelineTimeZone: string;
	timelineTimeZoneMode: TimelineTimeZoneMode;
};

export async function loadStoredPreferences(): Promise<StoredPreferences> {
	const rawPreferences = await readPreferencesValue();

	if (!rawPreferences) {
		return getDefaultPreferences();
	}

	try {
		const parsed = JSON.parse(rawPreferences) as Partial<StoredPreferences>;

		return {
			preferredVolumeUnit: isPreferredVolumeUnit(parsed.preferredVolumeUnit)
				? parsed.preferredVolumeUnit
				: DEFAULT_VOLUME_UNIT,
			preferredSolidFoodUnit: isPreferredSolidFoodUnit(parsed.preferredSolidFoodUnit)
				? parsed.preferredSolidFoodUnit
				: DEFAULT_SOLID_FOOD_UNIT,
			preferredLengthUnit: isPreferredLengthUnit(parsed.preferredLengthUnit)
				? parsed.preferredLengthUnit
				: DEFAULT_LENGTH_UNIT,
			preferredWeightUnit: isPreferredWeightUnit(parsed.preferredWeightUnit)
				? parsed.preferredWeightUnit
				: DEFAULT_WEIGHT_UNIT,
			themePreference: isThemePreference(parsed.themePreference)
				? parsed.themePreference
				: DEFAULT_THEME_PREFERENCE,
			timelineTimeZone: normalizeTimeZone(parsed.timelineTimeZone),
			timelineTimeZoneMode: isTimelineTimeZoneMode(parsed.timelineTimeZoneMode)
				? parsed.timelineTimeZoneMode
				: DEFAULT_TIMELINE_TIME_ZONE_MODE,
		};
	} catch {
		await saveStoredPreferences(getDefaultPreferences());
		return getDefaultPreferences();
	}
}

export async function saveStoredPreferences(preferences: StoredPreferences) {
	await writePreferencesValue(JSON.stringify(preferences));
}

function getDefaultPreferences(): StoredPreferences {
	return {
		preferredVolumeUnit: DEFAULT_VOLUME_UNIT,
		preferredSolidFoodUnit: DEFAULT_SOLID_FOOD_UNIT,
		preferredLengthUnit: DEFAULT_LENGTH_UNIT,
		preferredWeightUnit: DEFAULT_WEIGHT_UNIT,
		themePreference: DEFAULT_THEME_PREFERENCE,
		timelineTimeZone: getDeviceTimeZone(),
		timelineTimeZoneMode: DEFAULT_TIMELINE_TIME_ZONE_MODE,
	};
}

function isPreferredVolumeUnit(value: unknown): value is PreferredVolumeUnit {
	return value === "ml" || value === "oz";
}

function isPreferredSolidFoodUnit(value: unknown): value is PreferredSolidFoodUnit {
	return value === "servings" || value === "grams";
}

function isPreferredLengthUnit(value: unknown): value is PreferredLengthUnit {
	return value === "cm" || value === "in";
}

function isPreferredWeightUnit(value: unknown): value is PreferredWeightUnit {
	return value === "kg" || value === "lb";
}

function isTimelineTimeZoneMode(value: unknown): value is TimelineTimeZoneMode {
	return value === "baby" || value === "device";
}

function isThemePreference(value: unknown): value is ThemePreference {
	return value === "system" || value === "light" || value === "dark";
}

async function readPreferencesValue() {
	if (Platform.OS === "web") {
		return globalThis.localStorage?.getItem(PREFERENCES_STORAGE_KEY) ?? null;
	}

	return SecureStore.getItemAsync(PREFERENCES_STORAGE_KEY);
}

async function writePreferencesValue(value: string) {
	if (Platform.OS === "web") {
		globalThis.localStorage?.setItem(PREFERENCES_STORAGE_KEY, value);
		return;
	}

	await SecureStore.setItemAsync(PREFERENCES_STORAGE_KEY, value);
}
