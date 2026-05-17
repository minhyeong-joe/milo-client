import { useAuthSession } from "@/context/AuthSessionContext";
import { getBabies, type BabyListItem, type UpdateBabyRequest } from "@/services/api/babies";
import type { CreateBabyAvatarUploadRequest } from "@/services/api/babies";
import {
	applyPendingBabyAvatarMutations,
	enqueueBabyAvatarMutation,
	syncPendingBabyAvatarMutations,
} from "@/services/babies/babyAvatarOfflineStore";
import {
	applyPendingBabyProfileMutations,
	enqueueBabyProfileMutation,
	syncPendingBabyProfileMutations,
} from "@/services/babies/babyProfileOfflineStore";
import {
	loadCachedBabySelection,
	saveCachedBabySelection,
} from "@/services/babies/babyCacheStore";
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
	useRef,
	useState,
} from "react";

function reportBackgroundError(error: unknown) {
	console.warn(error);
}

type BabySelectionContextValue = {
	babies: BabyListItem[];
	error: string | null;
	isLoading: boolean;
	removeSelectedBabyAvatar: () => Promise<boolean>;
	refreshBabies: () => Promise<void>;
	selectBaby: (babyId: string) => void;
	saveSelectedBabyProfileDraft: (
		input: UpdateBabyRequest,
		avatarDraft?: SelectedBabyAvatarDraft,
	) => Promise<boolean>;
	selectedBaby: BabyListItem | null;
	selectedBabyId: string | null;
	updateSelectedBabyProfile: (input: UpdateBabyRequest) => Promise<boolean>;
	setSelectedBabyAvatar: (input: {
		contentType: CreateBabyAvatarUploadRequest["contentType"];
		localUri: string;
	}) => Promise<boolean>;
	syncPendingBabyAvatarChanges: () => Promise<void>;
};

type SelectedBabyAvatarDraft =
	| { status: "replace"; contentType: CreateBabyAvatarUploadRequest["contentType"]; localUri: string }
	| { status: "delete" }
	| { status: "unchanged" };

const BabySelectionContext = createContext<BabySelectionContextValue | null>(null);

export function BabySelectionProvider({ children }: PropsWithChildren) {
	const { isReady, session } = useAuthSession();
	const [babies, setBabies] = useState<BabyListItem[]>([]);
	const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedBabyIdRef = useRef<string | null>(null);

	useEffect(() => {
		selectedBabyIdRef.current = selectedBabyId;
	}, [selectedBabyId]);

	const refreshBabies = useCallback(async () => {
		if (!session) {
			setBabies([]);
			setSelectedBabyId(null);
			selectedBabyIdRef.current = null;
			setError(null);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const cachedSelection = await loadCachedBabySelection(session.user.id);

			if (cachedSelection) {
				const currentSelectedBabyId = selectedBabyIdRef.current;
				const cachedSelectedBabyId =
					getAccessibleBabyId(cachedSelection.babies, currentSelectedBabyId) ??
					getAccessibleBabyId(cachedSelection.babies, cachedSelection.selectedBabyId) ??
					cachedSelection.babies[0]?.id ??
					null;
				const cachedBabiesWithPendingProfiles = await applyPendingBabyProfileMutations(
					session.user.id,
					cachedSelection.babies,
				);
				const cachedBabiesWithPendingAvatars = await applyPendingBabyAvatarMutations(
					session.user.id,
					cachedBabiesWithPendingProfiles,
				);

				setBabies(cachedBabiesWithPendingAvatars);
				setSelectedBabyId(cachedSelectedBabyId);
				selectedBabyIdRef.current = cachedSelectedBabyId;
			}

			const response = await getBabies();
			const babiesWithPendingProfiles = await applyPendingBabyProfileMutations(
				session.user.id,
				response.babies,
			);
			const babiesWithPendingAvatars = await applyPendingBabyAvatarMutations(
				session.user.id,
				babiesWithPendingProfiles,
			);
			const storedBabyId = await loadStoredSelectedBabyId(session.user.id);
			const currentSelectedBabyId = selectedBabyIdRef.current;
			const nextSelectedBabyId =
				getAccessibleBabyId(babiesWithPendingAvatars, currentSelectedBabyId) ??
				getAccessibleBabyId(babiesWithPendingAvatars, storedBabyId) ??
				babiesWithPendingAvatars[0]?.id ??
				null;

			setBabies(babiesWithPendingAvatars);
			setSelectedBabyId(nextSelectedBabyId);
			selectedBabyIdRef.current = nextSelectedBabyId;
			await saveCachedBabySelection(session.user.id, babiesWithPendingAvatars, nextSelectedBabyId);

			if (nextSelectedBabyId) {
				await saveStoredSelectedBabyId(session.user.id, nextSelectedBabyId);
			}
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setIsLoading(false);
		}
	}, [session]);

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

	const setSelectedBabyAvatar = useCallback(async ({
		contentType,
		localUri,
	}: {
		contentType: CreateBabyAvatarUploadRequest["contentType"];
		localUri: string;
	}) => {
		if (!session || !selectedBaby) {
			return false;
		}

		const nextBabies = babies.map((baby) =>
			baby.id === selectedBaby.id
				? { ...baby, avatarObjectKey: "local:avatar", avatarUrl: localUri }
				: baby,
		);

		setBabies(nextBabies);
		await saveCachedBabySelection(session.user.id, nextBabies, selectedBaby.id);
		await enqueueBabyAvatarMutation({
			babyId: selectedBaby.id,
			contentType,
			localUri,
			operation: "replace",
			status: "pending",
			userId: session.user.id,
		});
		void syncPendingBabyAvatarMutations(session.user.id)
			.then(refreshBabies)
			.catch(reportBackgroundError);
		return true;
	}, [babies, refreshBabies, selectedBaby, session]);

	const updateSelectedBabyProfile = useCallback(async (input: UpdateBabyRequest) => {
		if (!session || !selectedBaby) {
			return false;
		}

		const now = new Date().toISOString();
		const nextBabies = babies.map((baby) =>
			baby.id === selectedBaby.id
				? {
						...baby,
						birthdate: input.birthdate,
						name: input.name,
						sex: input.sex,
						timezone: input.timezone ?? baby.timezone,
						updatedAt: now,
					}
				: baby,
		);

		setBabies(nextBabies);
		await saveCachedBabySelection(session.user.id, nextBabies, selectedBaby.id);
		await enqueueBabyProfileMutation({
			babyId: selectedBaby.id,
			payload: input,
			status: "pending",
			userId: session.user.id,
		});
		void syncPendingBabyProfileMutations(session.user.id)
			.then(refreshBabies)
			.catch(reportBackgroundError);
		return true;
	}, [babies, refreshBabies, selectedBaby, session]);

	const saveSelectedBabyProfileDraft = useCallback(async (
		input: UpdateBabyRequest,
		avatarDraft: SelectedBabyAvatarDraft = { status: "unchanged" },
	) => {
		if (!session || !selectedBaby) {
			return false;
		}

		const now = new Date().toISOString();
		const nextBabies = babies.map((baby) => {
			if (baby.id !== selectedBaby.id) {
				return baby;
			}

			const nextBaby = {
				...baby,
				birthdate: input.birthdate,
				name: input.name,
				sex: input.sex,
				timezone: input.timezone ?? baby.timezone,
				updatedAt: now,
			};

			if (avatarDraft.status === "replace") {
				return {
					...nextBaby,
					avatarObjectKey: "local:avatar",
					avatarUrl: avatarDraft.localUri,
				};
			}

			if (avatarDraft.status === "delete") {
				return {
					...nextBaby,
					avatarObjectKey: null,
					avatarUrl: null,
				};
			}

			return nextBaby;
		});

		setBabies(nextBabies);
		await saveCachedBabySelection(session.user.id, nextBabies, selectedBaby.id);
		await enqueueBabyProfileMutation({
			babyId: selectedBaby.id,
			payload: input,
			status: "pending",
			userId: session.user.id,
		});

		if (avatarDraft.status === "replace") {
			await enqueueBabyAvatarMutation({
				babyId: selectedBaby.id,
				contentType: avatarDraft.contentType,
				localUri: avatarDraft.localUri,
				operation: "replace",
				status: "pending",
				userId: session.user.id,
			});
		} else if (avatarDraft.status === "delete") {
			await enqueueBabyAvatarMutation({
				babyId: selectedBaby.id,
				contentType: null,
				localUri: null,
				operation: "delete",
				status: "pending",
				userId: session.user.id,
			});
		}

		return true;
	}, [babies, selectedBaby, session]);

	const removeSelectedBabyAvatar = useCallback(async () => {
		if (!session || !selectedBaby) {
			return false;
		}

		const nextBabies = babies.map((baby) =>
			baby.id === selectedBaby.id
				? { ...baby, avatarObjectKey: null, avatarUrl: null }
				: baby,
		);

		setBabies(nextBabies);
		await saveCachedBabySelection(session.user.id, nextBabies, selectedBaby.id);
		await enqueueBabyAvatarMutation({
			babyId: selectedBaby.id,
			contentType: null,
			localUri: null,
			operation: "delete",
			status: "pending",
			userId: session.user.id,
		});
		void syncPendingBabyAvatarMutations(session.user.id)
			.then(refreshBabies)
			.catch(reportBackgroundError);
		return true;
	}, [babies, refreshBabies, selectedBaby, session]);

	const syncPendingBabyAvatarChanges = useCallback(async () => {
		if (!session) {
			return;
		}

		await syncPendingBabyProfileMutations(session.user.id);
		await syncPendingBabyAvatarMutations(session.user.id);
		await refreshBabies();
	}, [refreshBabies, session]);

	const value = useMemo<BabySelectionContextValue>(
		() => ({
			babies,
			error,
			isLoading,
			removeSelectedBabyAvatar,
			refreshBabies,
			saveSelectedBabyProfileDraft,
			selectBaby: (babyId) => {
				setSelectedBabyId(babyId);
				selectedBabyIdRef.current = babyId;

				if (session) {
					void saveStoredSelectedBabyId(session.user.id, babyId);
					void saveCachedBabySelection(session.user.id, babies, babyId).catch(reportBackgroundError);
				}
			},
			selectedBaby,
			selectedBabyId,
			setSelectedBabyAvatar,
			syncPendingBabyAvatarChanges,
			updateSelectedBabyProfile,
		}),
		[
			babies,
			error,
			isLoading,
			refreshBabies,
			removeSelectedBabyAvatar,
			saveSelectedBabyProfileDraft,
			selectedBaby,
			selectedBabyId,
			session,
			setSelectedBabyAvatar,
			syncPendingBabyAvatarChanges,
			updateSelectedBabyProfile,
		],
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
