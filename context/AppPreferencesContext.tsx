import type { PreferredVolumeUnit } from "@/data/homeData";
import {
	loadStoredPreferences,
	saveStoredPreferences,
	type PreferredSolidFoodUnit,
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
	setPreferredSolidFoodUnit: (unit: PreferredSolidFoodUnit) => Promise<void>;
	setPreferredVolumeUnit: (unit: PreferredVolumeUnit) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
	const [preferredVolumeUnit, setPreferredVolumeUnitState] =
		useState<PreferredVolumeUnit>("ml");
	const [preferredSolidFoodUnit, setPreferredSolidFoodUnitState] =
		useState<PreferredSolidFoodUnit>("bowl");
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
			preferredSolidFoodUnit,
			preferredVolumeUnit: unit,
		});
	}, [preferredSolidFoodUnit]);

	const setPreferredSolidFoodUnit = useCallback(async (unit: PreferredSolidFoodUnit) => {
		setPreferredSolidFoodUnitState(unit);
		await saveStoredPreferences({
			preferredSolidFoodUnit: unit,
			preferredVolumeUnit,
		});
	}, [preferredVolumeUnit]);

	const value = useMemo(
		() => ({
			isReady,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
		}),
		[
			isReady,
			preferredSolidFoodUnit,
			preferredVolumeUnit,
			setPreferredSolidFoodUnit,
			setPreferredVolumeUnit,
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
