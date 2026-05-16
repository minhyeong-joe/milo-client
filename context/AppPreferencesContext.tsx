import type { PreferredVolumeUnit } from "@/data/homeData";
import type { BabyListItem } from "@/services/api/babies";
import {
	loadStoredPreferences,
	saveStoredPreferences,
	type PreferredLengthUnit,
	type PreferredSolidFoodUnit,
	type PreferredWeightUnit,
	type StoredPreferences,
} from "@/services/preferences/preferencesStorage";
import type { TimelineTimeZoneMode } from "@/utils/timeZones";
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

type AppPreferencesContextValue = StoredPreferences & {
	isReady: boolean;
	setPreferredLengthUnit: (unit: PreferredLengthUnit) => Promise<void>;
	setPreferredSolidFoodUnit: (unit: PreferredSolidFoodUnit) => Promise<void>;
	setPreferredVolumeUnit: (unit: PreferredVolumeUnit) => Promise<void>;
	setPreferredWeightUnit: (unit: PreferredWeightUnit) => Promise<void>;
	setTimelineTimeZone: (timeZone: string) => Promise<void>;
	setTimelineTimeZoneMode: (mode: TimelineTimeZoneMode) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
	const [preferredVolumeUnit, setPreferredVolumeUnitState] =
		useState<PreferredVolumeUnit>("ml");
	const [preferredSolidFoodUnit, setPreferredSolidFoodUnitState] =
		useState<PreferredSolidFoodUnit>("servings");
	const [preferredLengthUnit, setPreferredLengthUnitState] =
		useState<PreferredLengthUnit>("cm");
	const [preferredWeightUnit, setPreferredWeightUnitState] =
		useState<PreferredWeightUnit>("kg");
	const [timelineTimeZone, setTimelineTimeZoneState] =
		useState(() => getDeviceTimeZone());
	const [timelineTimeZoneMode, setTimelineTimeZoneModeState] =
		useState<TimelineTimeZoneMode>("baby");
	const [isReady, setIsReady] = useState(false);

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
			setTimelineTimeZoneState(storedPreferences.timelineTimeZone);
			setTimelineTimeZoneModeState(storedPreferences.timelineTimeZoneMode);
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
			timelineTimeZone,
			timelineTimeZoneMode,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredWeightUnit, timelineTimeZone, timelineTimeZoneMode]);

	const setPreferredSolidFoodUnit = useCallback(async (unit: PreferredSolidFoodUnit) => {
		setPreferredSolidFoodUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit: unit,
			preferredVolumeUnit,
			preferredWeightUnit,
			timelineTimeZone,
			timelineTimeZoneMode,
		});
	}, [preferredLengthUnit, preferredVolumeUnit, preferredWeightUnit, timelineTimeZone, timelineTimeZoneMode]);

	const setPreferredLengthUnit = useCallback(async (unit: PreferredLengthUnit) => {
		setPreferredLengthUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit: unit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			timelineTimeZone,
			timelineTimeZoneMode,
		});
	}, [preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, timelineTimeZone, timelineTimeZoneMode]);

	const setPreferredWeightUnit = useCallback(async (unit: PreferredWeightUnit) => {
		setPreferredWeightUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit: unit,
			timelineTimeZone,
			timelineTimeZoneMode,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, timelineTimeZone, timelineTimeZoneMode]);

	const setTimelineTimeZone = useCallback(async (timeZone: string) => {
		const normalizedTimeZone = normalizeTimeZone(timeZone);
		setTimelineTimeZoneState(normalizedTimeZone);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			timelineTimeZone: normalizedTimeZone,
			timelineTimeZoneMode,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, timelineTimeZoneMode]);

	const setTimelineTimeZoneMode = useCallback(async (mode: TimelineTimeZoneMode) => {
		setTimelineTimeZoneModeState(mode);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			timelineTimeZone,
			timelineTimeZoneMode: mode,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit, timelineTimeZone]);

	const value = useMemo(
		() => ({
			isReady,
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			setTimelineTimeZone,
			setTimelineTimeZoneMode,
			timelineTimeZone,
			timelineTimeZoneMode,
			setPreferredLengthUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
			setPreferredWeightUnit,
		}),
		[
			isReady,
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
			setTimelineTimeZone,
			setTimelineTimeZoneMode,
			setPreferredLengthUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
			setPreferredWeightUnit,
			timelineTimeZone,
			timelineTimeZoneMode,
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

export function useTimelineTimeZone(baby?: Pick<BabyListItem, "timezone"> | null) {
	const { timelineTimeZone, timelineTimeZoneMode } = useAppPreferences();

	return timelineTimeZoneMode === "baby"
		? normalizeTimeZone(baby?.timezone)
		: normalizeTimeZone(timelineTimeZone);
}
