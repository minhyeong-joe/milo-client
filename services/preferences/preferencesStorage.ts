import type { PreferredVolumeUnit } from "@/data/homeData";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PREFERENCES_STORAGE_KEY = "milo.preferences";
const DEFAULT_VOLUME_UNIT: PreferredVolumeUnit = "ml";
const DEFAULT_SOLID_FOOD_UNIT: PreferredSolidFoodUnit = "bowl";

export type PreferredSolidFoodUnit = "bowl" | "grams";

export type StoredPreferences = {
	preferredVolumeUnit: PreferredVolumeUnit;
	preferredSolidFoodUnit: PreferredSolidFoodUnit;
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
	};
}

function isPreferredVolumeUnit(value: unknown): value is PreferredVolumeUnit {
	return value === "ml" || value === "oz";
}

function isPreferredSolidFoodUnit(value: unknown): value is PreferredSolidFoodUnit {
	return value === "bowl" || value === "grams";
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
