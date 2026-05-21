import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import {
	createGrowthRecord as createGrowthRecordApi,
	deleteGrowthRecord as deleteGrowthRecordApi,
	getGrowthRecords,
	type GrowthRecord,
	type GrowthRecordInput,
	updateGrowthRecord as updateGrowthRecordApi,
} from "@/services/api/growth";
import { ApiError } from "@/services/api/httpClient";
import {
	deleteQueuedGrowthCreateByLocalId,
	enqueueGrowthMutation,
	loadCachedGrowthRecords,
	loadPendingGrowthMutations,
	markGrowthMutationFailed,
	markGrowthMutationSynced,
	markGrowthRecordDeleted,
	mergeServerGrowthRecords,
	removeGrowthRecordCache,
	replaceLocalGrowthId,
	type LocalGrowthRecord,
	updateQueuedGrowthCreateByLocalId,
	upsertLocalGrowthRecord,
} from "@/services/growth/growthOfflineStore";
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

type GrowthDataContextValue = {
	createGrowthRecord: (input: GrowthRecordInput) => Promise<boolean>;
	deleteGrowthRecord: (growthId: string) => Promise<boolean>;
	getGrowthRecord: (growthId: string) => LocalGrowthRecord | undefined;
	growthRecords: LocalGrowthRecord[];
	isLoading: boolean;
	loadGrowthRecords: (options?: { sync?: boolean }) => Promise<void>;
	syncError: string | null;
	syncPendingGrowthMutations: () => Promise<void>;
	updateGrowthRecord: (growthId: string, input: GrowthRecordInput) => Promise<boolean>;
};

const GrowthDataContext = createContext<GrowthDataContextValue | undefined>(undefined);
const OFFLINE_SYNC_MESSAGE = "Offline mode. Sync will be re-enabled once online.";

function reportBackgroundError(error: unknown) {
	console.warn(error);
}

export function GrowthDataProvider({ children }: PropsWithChildren) {
	const { authStatus, session } = useAuthSession();
	const { selectedBaby } = useBabySelection();
	const selectedScopeKey = useMemo(
		() => session && selectedBaby ? getGrowthScopeKey(session.user.id, selectedBaby.id) : null,
		[session?.user.id, selectedBaby?.id],
	);
	const [growthRecords, setGrowthRecords] = useState<LocalGrowthRecord[]>([]);
	const [dataScopeKey, setDataScopeKey] = useState<string | null>(selectedScopeKey);
	const [isLoading, setIsLoading] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const syncPromiseRef = useRef<Promise<void> | null>(null);
	const syncPromiseScopeRef = useRef<string | null>(null);
	const loadRequestIdRef = useRef(0);
	const selectedScopeKeyRef = useRef<string | null>(selectedScopeKey);
	const scopedGrowthRecords = dataScopeKey === selectedScopeKey ? growthRecords : [];

	useEffect(() => {
		selectedScopeKeyRef.current = selectedScopeKey;
	}, [selectedScopeKey]);

	const reloadLocalGrowthRecords = useCallback(async () => {
		if (!session || !selectedBaby) {
			setDataScopeKey(selectedScopeKey);
			setGrowthRecords([]);
			setSyncError(null);
			return;
		}

		const scopeKey = getGrowthScopeKey(session.user.id, selectedBaby.id);
		const cachedRecords = await loadCachedGrowthRecords(session.user.id, selectedBaby.id);

		if (selectedScopeKeyRef.current !== scopeKey) {
			return;
		}

		setDataScopeKey(scopeKey);
		setGrowthRecords(cachedRecords.sort(sortGrowthRecordsDescending));
	}, [selectedBaby, selectedScopeKey, session]);

	const syncPendingGrowthMutations = useCallback(async () => {
		if (!session || !selectedBaby) return;

		if (authStatus === "authRequiredForSync") {
			setSyncError("Sync paused. Sign in again to sync changes.");
			return;
		}

		const scopeKey = getGrowthScopeKey(session.user.id, selectedBaby.id);

		if (syncPromiseRef.current && syncPromiseScopeRef.current === scopeKey) {
			return syncPromiseRef.current;
		}

		if (syncPromiseRef.current) {
			return;
		}

		syncPromiseScopeRef.current = scopeKey;
		syncPromiseRef.current = (async () => {
			const mutations = await loadPendingGrowthMutations(session.user.id, selectedBaby.id);
			let hadTransientError = false;

			for (const mutation of mutations) {
				try {
					if (mutation.operation === "create") {
						const response = await createGrowthRecordApi(mutation.babyId, mutation.payload);

						if (mutation.localId) {
							await replaceLocalGrowthId({
								babyId: mutation.babyId,
								localId: mutation.localId,
								record: response.growthRecord,
								userId: mutation.userId,
							});
						} else {
							await upsertLocalGrowthRecord({
								babyId: mutation.babyId,
								record: response.growthRecord,
								syncStatus: "synced",
								userId: mutation.userId,
							});
						}
					} else if (mutation.operation === "update") {
						if (!mutation.growthId) {
							throw new Error("Missing growth id for queued update.");
						}

						const response = await updateGrowthRecordApi(
							mutation.babyId,
							mutation.growthId,
							mutation.payload,
						);
						await upsertLocalGrowthRecord({
							babyId: mutation.babyId,
							record: response.growthRecord,
							syncStatus: "synced",
							userId: mutation.userId,
						});
					} else {
						if (!mutation.growthId) {
							throw new Error("Missing growth id for queued delete.");
						}

						await deleteGrowthRecordApi(mutation.babyId, mutation.growthId);
						await removeGrowthRecordCache({
							babyId: mutation.babyId,
							growthId: mutation.growthId,
							userId: mutation.userId,
						});
					}

					await markGrowthMutationSynced(mutation.id);
				} catch (error) {
					if (isPermanentSyncError(error)) {
						const message = getErrorMessage(error);
						await markGrowthMutationFailed(mutation.id, message);

						if (mutation.growthId ?? mutation.localId) {
							const failedId = mutation.growthId ?? mutation.localId;
							setGrowthRecords((records) =>
								selectedScopeKeyRef.current === scopeKey
									? records.map((record) =>
									record.id === failedId
										? { ...record, syncError: message, syncStatus: "failed" }
										: record,
									)
									: records,
							);
						}
					} else {
						hadTransientError = true;
						if (selectedScopeKeyRef.current === scopeKey) {
							setSyncError(OFFLINE_SYNC_MESSAGE);
						}
						break;
					}
				}
			}

			if (!hadTransientError && selectedScopeKeyRef.current === scopeKey) {
				setSyncError(null);
			}

			if (selectedScopeKeyRef.current === scopeKey) {
				await reloadLocalGrowthRecords();
			}
		})();

		try {
			await syncPromiseRef.current;
		} finally {
			syncPromiseRef.current = null;
			syncPromiseScopeRef.current = null;
		}
	}, [authStatus, reloadLocalGrowthRecords, selectedBaby, session]);

	const loadGrowthRecords = useCallback(async (options: { sync?: boolean } = {}) => {
		if (!session || !selectedBaby) {
			setDataScopeKey(selectedScopeKey);
			setGrowthRecords([]);
			setSyncError(null);
			return;
		}

		const requestId = loadRequestIdRef.current + 1;
		loadRequestIdRef.current = requestId;
		const scopeKey = getGrowthScopeKey(session.user.id, selectedBaby.id);

		setIsLoading(true);

		try {
			await reloadLocalGrowthRecords();

			if (selectedScopeKeyRef.current !== scopeKey) {
				return;
			}

			if (options.sync) {
				await syncPendingGrowthMutations();
				const response = await getGrowthRecords(selectedBaby.id);

				if (selectedScopeKeyRef.current !== scopeKey || loadRequestIdRef.current !== requestId) {
					return;
				}

				await mergeServerGrowthRecords({
					babyId: selectedBaby.id,
					records: response.growthRecords,
					userId: session.user.id,
				});
				await reloadLocalGrowthRecords();
				if (selectedScopeKeyRef.current === scopeKey) {
					setSyncError(null);
				}
			}
		} catch (error) {
			if (selectedScopeKeyRef.current === scopeKey) {
				setSyncError(getErrorMessage(error));
			}
			throw error;
		} finally {
			if (loadRequestIdRef.current === requestId) {
				setIsLoading(false);
			}
		}
	}, [
		reloadLocalGrowthRecords,
		selectedBaby,
		session,
		syncPendingGrowthMutations,
	]);

	useEffect(() => {
		void loadGrowthRecords({ sync: false }).catch(reportBackgroundError);
	}, [loadGrowthRecords]);

	const createGrowthRecord = useCallback(async (input: GrowthRecordInput) => {
		if (!session || !selectedBaby) return false;

		const now = new Date().toISOString();
		const localId = getLocalId();
		const localRecord: LocalGrowthRecord = {
			babyId: selectedBaby.id,
			createdAt: now,
			headCircumferenceMm: input.headCircumferenceMm ?? null,
			heightMm: input.heightMm ?? null,
			id: localId,
			measuredDate: input.measuredDate,
			notes: input.notes?.trim() ? input.notes.trim() : null,
			syncStatus: "pending",
			updatedAt: now,
			weightGrams: input.weightGrams ?? null,
		};

		setDataScopeKey(selectedScopeKey);
		setGrowthRecords((records) =>
			[localRecord, ...records].sort(sortGrowthRecordsDescending),
		);
		await upsertLocalGrowthRecord({
			babyId: selectedBaby.id,
			record: localRecord,
			syncStatus: "pending",
			userId: session.user.id,
		});
		await enqueueGrowthMutation({
			babyId: selectedBaby.id,
			id: createUuid(),
			localId,
			operation: "create",
			payload: input,
			status: "pending",
			userId: session.user.id,
		});
		void syncPendingGrowthMutations();
		return true;
	}, [selectedBaby, selectedScopeKey, session, syncPendingGrowthMutations]);

	const updateGrowthRecord = useCallback(async (growthId: string, input: GrowthRecordInput) => {
		if (!session || !selectedBaby) return false;

		const now = new Date().toISOString();
		const existingRecord = scopedGrowthRecords.find((record) => record.id === growthId);

		setDataScopeKey(selectedScopeKey);
		setGrowthRecords((records) => {
			if (!existingRecord) {
				return records;
			}

			return records
				.map((record) =>
					record.id === growthId
						? {
								...record,
								headCircumferenceMm: input.headCircumferenceMm ?? null,
								heightMm: input.heightMm ?? null,
								measuredDate: input.measuredDate,
								notes: input.notes?.trim() ? input.notes.trim() : null,
								syncError: null,
								syncStatus: "pending" as const,
								updatedAt: now,
								weightGrams: input.weightGrams ?? null,
							}
						: record,
				)
				.sort(sortGrowthRecordsDescending);
		});

		const nextRecord = {
			...(existingRecord ?? {
				babyId: selectedBaby.id,
				createdAt: now,
				id: growthId,
			}),
			headCircumferenceMm: input.headCircumferenceMm ?? null,
			heightMm: input.heightMm ?? null,
			measuredDate: input.measuredDate,
			notes: input.notes?.trim() ? input.notes.trim() : null,
			updatedAt: now,
			weightGrams: input.weightGrams ?? null,
		} satisfies GrowthRecord;

		await upsertLocalGrowthRecord({
			babyId: selectedBaby.id,
			record: nextRecord,
			syncStatus: "pending",
			userId: session.user.id,
		});

		if (growthId.startsWith("local:")) {
			await updateQueuedGrowthCreateByLocalId({
				babyId: selectedBaby.id,
				localId: growthId,
				payload: input,
				userId: session.user.id,
			});
		} else {
			await enqueueGrowthMutation({
				babyId: selectedBaby.id,
				growthId,
				id: createUuid(),
				operation: "update",
				payload: input,
				status: "pending",
				userId: session.user.id,
			});
		}

		void syncPendingGrowthMutations();
		return true;
	}, [scopedGrowthRecords, selectedBaby, selectedScopeKey, session, syncPendingGrowthMutations]);

	const deleteGrowthRecord = useCallback(async (growthId: string) => {
		if (!session || !selectedBaby) return false;

		setDataScopeKey(selectedScopeKey);
		setGrowthRecords((records) => records.filter((record) => record.id !== growthId));

		if (growthId.startsWith("local:")) {
			await deleteQueuedGrowthCreateByLocalId({
				babyId: selectedBaby.id,
				localId: growthId,
				userId: session.user.id,
			});
			await removeGrowthRecordCache({
				babyId: selectedBaby.id,
				growthId,
				userId: session.user.id,
			});
		} else {
			await markGrowthRecordDeleted({
				babyId: selectedBaby.id,
				growthId,
				userId: session.user.id,
			});
			await enqueueGrowthMutation({
				babyId: selectedBaby.id,
				growthId,
				id: createUuid(),
				operation: "delete",
				payload: { measuredDate: "" },
				status: "pending",
				userId: session.user.id,
			});
		}

		void syncPendingGrowthMutations();
		return true;
	}, [selectedBaby, selectedScopeKey, session, syncPendingGrowthMutations]);

	const value = useMemo<GrowthDataContextValue>(() => ({
		createGrowthRecord,
		deleteGrowthRecord,
		getGrowthRecord: (growthId) => scopedGrowthRecords.find((record) => record.id === growthId),
		growthRecords: scopedGrowthRecords,
		isLoading,
		loadGrowthRecords,
		syncError,
		syncPendingGrowthMutations,
		updateGrowthRecord,
	}), [
		createGrowthRecord,
		dataScopeKey,
		deleteGrowthRecord,
		scopedGrowthRecords,
		isLoading,
		loadGrowthRecords,
		syncError,
		syncPendingGrowthMutations,
		updateGrowthRecord,
	]);

	return (
		<GrowthDataContext.Provider value={value}>
			{children}
		</GrowthDataContext.Provider>
	);
}

export function useGrowthData() {
	const context = useContext(GrowthDataContext);

	if (!context) {
		throw new Error("useGrowthData must be used within GrowthDataProvider");
	}

	return context;
}

function sortGrowthRecordsDescending(left: GrowthRecord, right: GrowthRecord) {
	const byDate = right.measuredDate.localeCompare(left.measuredDate);

	if (byDate !== 0) {
		return byDate;
	}

	return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function getLocalId() {
	return `local:growth:${createUuid()}`;
}

function getGrowthScopeKey(userId: string, babyId: string) {
	return `${userId}:${babyId}`;
}

function createUuid() {
	if (globalThis.crypto?.randomUUID) {
		return globalThis.crypto.randomUUID();
	}

	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
		const random = Math.floor(Math.random() * 16);
		const next = value === "x" ? random : (random & 0x3) | 0x8;
		return next.toString(16);
	});
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not sync growth measurements.";
}

function isPermanentSyncError(error: unknown) {
	return error instanceof ApiError &&
		error.status >= 400 &&
		error.status < 500 &&
		error.status !== 401 &&
		error.status !== 403;
}
