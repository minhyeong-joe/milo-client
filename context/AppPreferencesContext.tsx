import type { PreferredVolumeUnit } from "@/data/homeData";
import type { BabyListItem } from "@/services/api/babies";
import {
	loadStoredPreferences,
	saveStoredPreferences,
	type PreferredLengthUnit,
	type PreferredSolidFoodUnit,
	type PreferredWeightUnit,
	type StoredPreferences,
	type ThemePreference,
	type LanguagePreference,
	type DisplayTimeZonePreference,
} from "@/services/preferences/preferencesStorage";
import {
	createGlobalStyles,
	colors,
	type ResolvedTheme,
	type ThemeColors,
} from "@/styles/globalStyles";
import { getDeviceTimeZone, normalizeTimeZone } from "@/utils/timeZones";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useColorScheme } from "react-native";

type AppPreferencesContextValue = StoredPreferences & {
	globalStyles: ReturnType<typeof createGlobalStyles>;
	isReady: boolean;
	resolvedTheme: ResolvedTheme;
	setPreferredLengthUnit: (unit: PreferredLengthUnit) => Promise<void>;
	setPreferredSolidFoodUnit: (unit: PreferredSolidFoodUnit) => Promise<void>;
	setPreferredVolumeUnit: (unit: PreferredVolumeUnit) => Promise<void>;
	setPreferredWeightUnit: (unit: PreferredWeightUnit) => Promise<void>;
	setThemePreference: (preference: ThemePreference) => Promise<void>;
	setLanguagePreference: (prefernce: LanguagePreference) => Promise<void>;
	setDisplayTimeZonePreference: (preference: DisplayTimeZonePreference) => Promise<void>;
	themeColors: ThemeColors;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
	const systemColorScheme = useColorScheme();
	const [preferredVolumeUnit, setPreferredVolumeUnitState] =
		useState<PreferredVolumeUnit>("ml");
	const [preferredSolidFoodUnit, setPreferredSolidFoodUnitState] =
		useState<PreferredSolidFoodUnit>("servings");
	const [preferredLengthUnit, setPreferredLengthUnitState] =
		useState<PreferredLengthUnit>("cm");
	const [preferredWeightUnit, setPreferredWeightUnitState] =
		useState<PreferredWeightUnit>("kg");
	const [themePreference, setThemePreferenceState] =
		useState<ThemePreference>("system");
	const [languagePreference, setLanguagePreferenceState] =
		useState<LanguagePreference>("en-US");
	const [displayTimeZonePreference, setDisplayTimeZonePreferenceState] =
		useState<DisplayTimeZonePreference>(null);
	const [isReady, setIsReady] = useState(false);
	const resolvedTheme: ResolvedTheme =
		themePreference === "system"
			? systemColorScheme === "dark" ? "dark" : "light"
			: themePreference;
	const themeColors = colors[resolvedTheme];

	const globalStyles = useMemo(
		() => createGlobalStyles(themeColors),
		[themeColors],
	);

	useEffect(() => {
		let isMounted = true;

		async function loadPreferences() {
			const storedPreferences = await loadStoredPreferences();

			if (!isMounted) {
				return;
			}

			setPreferredVolumeUnitState(storedPreferences.preferredVolumeUnit);
			setPreferredSolidFoodUnitState(storedPreferences.preferredSolidFoodUnit);
			setPreferredLengthUnitState(storedPreferences.preferredLengthUnit);
			setPreferredWeightUnitState(storedPreferences.preferredWeightUnit);
			setThemePreferenceState(storedPreferences.themePreference);
			setLanguagePreferenceState(storedPreferences.languagePreference);
			setDisplayTimeZonePreferenceState(storedPreferences.displayTimeZonePreference);
			setIsReady(true);
		}

		void loadPreferences();

		return () => {
			isMounted = false;
		};
	}, []);

	const setPreferredVolumeUnit = useCallback(async (unit: PreferredVolumeUnit) => {
		setPreferredVolumeUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit: unit,
			preferredWeightUnit,
			themePreference,
			languagePreference,
			displayTimeZonePreference,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredWeightUnit, themePreference, languagePreference, displayTimeZonePreference]);

	const setPreferredSolidFoodUnit = useCallback(async (unit: PreferredSolidFoodUnit) => {
		setPreferredSolidFoodUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit: unit,
			preferredVolumeUnit,
			preferredWeightUnit,
			themePreference,
			languagePreference,
			displayTimeZonePreference,
		});
	}, [preferredLengthUnit, preferredVolumeUnit, preferredWeightUnit, themePreference, languagePreference, displayTimeZonePreference]);

	const setPreferredLengthUnit = useCallback(async (unit: PreferredLengthUnit) => {
		setPreferredLengthUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit: unit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			themePreference,
			languagePreference,
			displayTimeZonePreference,
		});
	}, [preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, themePreference, languagePreference, displayTimeZonePreference]);

	const setPreferredWeightUnit = useCallback(async (unit: PreferredWeightUnit) => {
		setPreferredWeightUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit: unit,
			themePreference,
			languagePreference,
			displayTimeZonePreference,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, themePreference, languagePreference, displayTimeZonePreference]);

	const setThemePreference = useCallback(async (preference: ThemePreference) => {
		setThemePreferenceState(preference);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			themePreference: preference,
			languagePreference,
			displayTimeZonePreference,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, languagePreference, displayTimeZonePreference]);

	const setLanguagePreference = useCallback(async (preference: LanguagePreference) => {
		setLanguagePreferenceState(preference);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			themePreference,
			languagePreference: preference,
			displayTimeZonePreference,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, themePreference, displayTimeZonePreference]);

	const setDisplayTimeZonePreference = useCallback(async (preference: DisplayTimeZonePreference) => {
		setDisplayTimeZonePreferenceState(preference);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			themePreference,
			languagePreference,
			displayTimeZonePreference: preference,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, themePreference, languagePreference]);

	const value = useMemo(
		() => ({
			globalStyles,
			isReady,
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			resolvedTheme,
			setThemePreference,
			setLanguagePreference,
			themeColors,
			themePreference,
			languagePreference,
			displayTimeZonePreference,
			setPreferredLengthUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
			setPreferredWeightUnit,
			setDisplayTimeZonePreference,
		}),
		[
			isReady,
			globalStyles,
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			resolvedTheme,
			setThemePreference,
			setLanguagePreference,
			themeColors,
			themePreference,
			languagePreference,
			displayTimeZonePreference,
			setPreferredLengthUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
			setPreferredWeightUnit,
			setDisplayTimeZonePreference,
		],
	);

	return (
		<AppPreferencesContext.Provider value={value}>
			{children}
		</AppPreferencesContext.Provider>
	);
}

export function useAppPreferences() {
	const context = useContext(AppPreferencesContext);

	if (!context) {
		throw new Error("useAppPreferences must be used within AppPreferencesProvider");
	}

	return context;
}

export function useAppTheme() {
	const { globalStyles, resolvedTheme, themeColors, themePreference, setThemePreference } =
		useAppPreferences();

	return {
		globalStyles,
		resolvedTheme,
		setThemePreference,
		themeColors,
		themePreference,
	};
}

export function useTimelineTimeZone(baby?: Pick<BabyListItem, "timezone"> | null) {
	return normalizeTimeZone(baby?.timezone);
}

export function useDisplayTimeZone(baby?: Pick<BabyListItem, "timezone"> | null) {
	const { displayTimeZonePreference } = useAppPreferences();

	if (displayTimeZonePreference === "device") {
		return normalizeTimeZone(getDeviceTimeZone());
	}

	return normalizeTimeZone(displayTimeZonePreference ?? baby?.timezone);
}
