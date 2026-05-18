import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import { useImmunizationData } from "@/context/ImmunizationDataContext";
import { useRoutineData } from "@/context/RoutineDataContext";
import { syncPendingTagMutations } from "@/services/tags/tagOfflineStore";
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";

export type SyncStatus = "idle" | "syncing" | "offline" | "authRequired" | "error";
export type ConnectionStatus = "online" | "offline" | "authRequired";

type SyncNowOptions = {
	babyId?: string;
	scope?: "growth" | "immunizations" | "routine" | "tags" | "all";
};

type SyncContextValue = {
	connectionStatus: ConnectionStatus;
	error: string | null;
	markAuthRequired: () => void;
	markOffline: (message?: string) => void;
	markOnline: () => void;
	status: SyncStatus;
	syncNow: (options?: SyncNowOptions) => Promise<boolean>;
};

const SyncContext = createContext<SyncContextValue | null>(null);
export const OFFLINE_SYNC_MESSAGE = "Offline mode. Sync will be re-enabled once online.";
export const AUTH_REQUIRED_SYNC_MESSAGE = "Login failed. Sign in again to sync changes.";
const SYNC_TIMEOUT_MS = 10000;

export function SyncProvider({ children }: PropsWithChildren) {
	const { authStatus, session } = useAuthSession();
	const { refreshBabies, selectedBaby, syncPendingBabyAvatarChanges } = useBabySelection();
	const { syncPendingGrowthMutations } = useGrowthData();
	const { syncPendingImmunizationMutations } = useImmunizationData();
	const { syncPendingMutations } = useRoutineData();
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("online");
	const [status, setStatus] = useState<SyncStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const syncPromiseRef = useRef<Promise<boolean> | null>(null);
	const markOnline = useCallback(() => {
		setConnectionStatus("online");
		setStatus("idle");
		setError(null);
	}, []);
	const markOffline = useCallback((message = OFFLINE_SYNC_MESSAGE) => {
		setConnectionStatus("offline");
		setStatus("offline");
		setError(message);
	}, []);
	const markAuthRequired = useCallback(() => {
		setConnectionStatus("authRequired");
		setStatus("authRequired");
		setError(AUTH_REQUIRED_SYNC_MESSAGE);
	}, []);

	const syncNow = useCallback(async (options: SyncNowOptions = {}) => {
		if (!session) {
			markAuthRequired();
			return false;
		}

		if (authStatus === "authRequiredForSync") {
			markAuthRequired();
			return false;
		}

		if (syncPromiseRef.current) {
			return syncPromiseRef.current;
		}

		const scope = options.scope ?? "all";

		syncPromiseRef.current = withTimeout((async () => {
			setStatus("syncing");
			setError(null);

			try {
				if (scope === "all") {
					await syncPendingBabyAvatarChanges();
					await refreshBabies();
				}

				if (scope === "all" || scope === "routine" || scope === "growth" || scope === "immunizations") {
					if (!options.babyId && !selectedBaby) {
						markOnline();
						return true;
					}
				}

				if (scope === "all" || scope === "routine") {
					await syncPendingMutations();
				}

				if (scope === "all" || scope === "growth") {
					await syncPendingGrowthMutations();
				}

				if (scope === "all" || scope === "immunizations") {
					await syncPendingImmunizationMutations();
				}

				if ((scope === "all" || scope === "tags") && selectedBaby) {
					await syncPendingTagMutations(session.user.id, selectedBaby.id);
				}

				markOnline();
				return true;
			} catch (caughtError) {
				const message = getSyncErrorMessage(caughtError);
				if (message === AUTH_REQUIRED_SYNC_MESSAGE) {
					markAuthRequired();
				} else {
					markOffline(message);
				}
				return false;
			} finally {
				syncPromiseRef.current = null;
			}
		})(), SYNC_TIMEOUT_MS).catch((caughtError) => {
			const message = getSyncErrorMessage(caughtError);
			if (message === AUTH_REQUIRED_SYNC_MESSAGE) {
				markAuthRequired();
			} else {
				markOffline(message);
			}
			syncPromiseRef.current = null;
			return false;
		});

		return syncPromiseRef.current;
	}, [
		authStatus,
		markAuthRequired,
		markOffline,
		markOnline,
		refreshBabies,
		selectedBaby,
		session,
		syncPendingGrowthMutations,
		syncPendingImmunizationMutations,
		syncPendingMutations,
		syncPendingBabyAvatarChanges,
	]);

	const value = useMemo<SyncContextValue>(
		() => ({
			connectionStatus,
			error,
			markAuthRequired,
			markOffline,
			markOnline,
			status,
			syncNow,
		}),
		[connectionStatus, error, markAuthRequired, markOffline, markOnline, status, syncNow],
	);

	return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
	const context = useContext(SyncContext);

	if (!context) {
		throw new Error("useSync must be used within SyncProvider");
	}

	return context;
}

function getSyncErrorMessage(error: unknown) {
	if (error instanceof Error && error.message === "SYNC_TIMEOUT") {
		return OFFLINE_SYNC_MESSAGE;
	}

	if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
		return AUTH_REQUIRED_SYNC_MESSAGE;
	}

	return OFFLINE_SYNC_MESSAGE;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error("SYNC_TIMEOUT")), timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
}
