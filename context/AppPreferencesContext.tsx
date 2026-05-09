import type { PreferredVolumeUnit } from "@/data/homeData";
import {
	loadStoredPreferences,
	saveStoredPreferences,
	type PreferredLengthUnit,
	type PreferredSolidFoodUnit,
	type PreferredWeightUnit,
	type StoredPreferences,
} from "@/services/preferences/preferencesStorage";
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
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredWeightUnit]);

	const setPreferredSolidFoodUnit = useCallback(async (unit: PreferredSolidFoodUnit) => {
		setPreferredSolidFoodUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit: unit,
			preferredVolumeUnit,
			preferredWeightUnit,
		});
	}, [preferredLengthUnit, preferredVolumeUnit, preferredWeightUnit]);

	const setPreferredLengthUnit = useCallback(async (unit: PreferredLengthUnit) => {
		setPreferredLengthUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit: unit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
		});
	}, [preferredSolidFoodUnit, preferredVolumeUnit, preferredWeightUnit]);

	const setPreferredWeightUnit = useCallback(async (unit: PreferredWeightUnit) => {
		setPreferredWeightUnitState(unit);
		await saveStoredPreferences({
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit: unit,
		});
	}, [preferredLengthUnit, preferredSolidFoodUnit, preferredVolumeUnit]);

	const value = useMemo(
		() => ({
			isReady,
			preferredLengthUnit,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			preferredWeightUnit,
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
			setPreferredLengthUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
			setPreferredWeightUnit,
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
