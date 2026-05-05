import { useAuthSession } from "@/context/AuthSessionContext";
import { getBabies, type BabyListItem } from "@/services/api/babies";
import {
	loadStoredSelectedBabyId,
	saveStoredSelectedBabyId,
} from "@/services/babies/selectedBabyStorage";
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type BabySelectionContextValue = {
	babies: BabyListItem[];
	error: string | null;
	isLoading: boolean;
	refreshBabies: () => Promise<void>;
	selectBaby: (babyId: string) => void;
	selectedBaby: BabyListItem | null;
	selectedBabyId: string | null;
};

const BabySelectionContext = createContext<BabySelectionContextValue | null>(null);

export function BabySelectionProvider({ children }: PropsWithChildren) {
	const { isReady, session } = useAuthSession();
	const [babies, setBabies] = useState<BabyListItem[]>([]);
	const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshBabies = useCallback(async () => {
		if (!session) {
			setBabies([]);
			setSelectedBabyId(null);
			setError(null);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await getBabies();
			const storedBabyId = await loadStoredSelectedBabyId(session.user.id);
			const nextSelectedBabyId =
				getAccessibleBabyId(response.babies, selectedBabyId) ??
				getAccessibleBabyId(response.babies, storedBabyId) ??
				response.babies[0]?.id ??
				null;

			setBabies(response.babies);
			setSelectedBabyId(nextSelectedBabyId);

			if (nextSelectedBabyId) {
				await saveStoredSelectedBabyId(session.user.id, nextSelectedBabyId);
			}
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setIsLoading(false);
		}
	}, [selectedBabyId, session]);

	useEffect(() => {
		if (!isReady) {
			return;
		}

		void refreshBabies();
	}, [isReady, refreshBabies]);

	const selectedBaby = useMemo(
		() => babies.find((baby) => baby.id === selectedBabyId) ?? null,
		[babies, selectedBabyId],
	);

	const value = useMemo<BabySelectionContextValue>(
		() => ({
			babies,
			error,
			isLoading,
			refreshBabies,
			selectBaby: (babyId) => {
				setSelectedBabyId(babyId);

				if (session) {
					void saveStoredSelectedBabyId(session.user.id, babyId);
				}
			},
			selectedBaby,
			selectedBabyId,
		}),
		[babies, error, isLoading, refreshBabies, selectedBaby, selectedBabyId, session],
	);

	return (
		<BabySelectionContext.Provider value={value}>
			{children}
		</BabySelectionContext.Provider>
	);
}

export function useBabySelection() {
	const context = useContext(BabySelectionContext);

	if (!context) {
		throw new Error("useBabySelection must be used inside BabySelectionProvider.");
	}

	return context;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not load baby profiles.";
}

function getAccessibleBabyId(babies: BabyListItem[], babyId: string | null) {
	if (!babyId) {
		return null;
	}

	return babies.some((baby) => baby.id === babyId) ? babyId : null;
}
