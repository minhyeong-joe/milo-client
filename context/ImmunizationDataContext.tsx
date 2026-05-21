import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import {
	createImmunizationRecord as createImmunizationRecordApi,
	deleteImmunizationRecord as deleteImmunizationRecordApi,
	getImmunizations,
	type BabyImmunizationRecord,
	type ImmunizationRecordInput,
	type ImmunizationScheduleItem,
	type ImmunizationScheduleProfile,
	updateImmunizationProfile as updateImmunizationProfileApi,
	updateImmunizationRecord as updateImmunizationRecordApi,
} from "@/services/api/immunizations";
import { ApiError } from "@/services/api/httpClient";
import {
	deleteQueuedImmunizationCreateByLocalId,
	enqueueImmunizationMutation,
	loadCachedImmunizations,
	loadPendingImmunizationMutations,
	markImmunizationMutationFailed,
	markImmunizationMutationSynced,
	markImmunizationRecordDeleted,
	mergeServerImmunizationRecords,
	removeImmunizationRecordCache,
	replaceLocalImmunizationId,
	saveImmunizationPayload,
	updateQueuedImmunizationCreateByLocalId,
	upsertLocalImmunizationRecord,
	type LocalImmunizationRecord,
} from "@/services/immunizations/immunizationOfflineStore";
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

type ImmunizationDataContextValue = {
	createImmunizationRecord: (input: ImmunizationRecordInput) => Promise<boolean>;
	deleteImmunizationRecord: (recordId: string) => Promise<boolean>;
	getImmunizationRecord: (recordId: string) => LocalImmunizationRecord | undefined;
	isLoading: boolean;
	loadImmunizations: (options?: { sync?: boolean }) => Promise<void>;
	records: LocalImmunizationRecord[];
	scheduleItems: ImmunizationScheduleItem[];
	scheduleProfile: ImmunizationScheduleProfile;
	syncError: string | null;
	syncPendingImmunizationMutations: () => Promise<void>;
	updateImmunizationProfile: (profile: ImmunizationScheduleProfile) => Promise<boolean>;
	updateImmunizationRecord: (recordId: string, input: ImmunizationRecordInput) => Promise<boolean>;
};

const ImmunizationDataContext = createContext<ImmunizationDataContextValue | undefined>(undefined);
const OFFLINE_SYNC_MESSAGE = "Offline mode. Sync will be re-enabled once online.";

function reportBackgroundError(error: unknown) {
	console.warn(error);
}

export function ImmunizationDataProvider({ children }: PropsWithChildren) {
	const { authStatus, session } = useAuthSession();
	const { selectedBaby } = useBabySelection();
	const selectedScopeKey = useMemo(
		() => session && selectedBaby ? getImmunizationScopeKey(session.user.id, selectedBaby.id) : null,
		[session?.user.id, selectedBaby?.id],
	);
	const [records, setRecords] = useState<LocalImmunizationRecord[]>([]);
	const [scheduleItems, setScheduleItems] = useState<ImmunizationScheduleItem[]>([]);
	const [scheduleProfile, setScheduleProfile] = useState<ImmunizationScheduleProfile>("US_CDC");
	const [dataScopeKey, setDataScopeKey] = useState<string | null>(selectedScopeKey);
	const [isLoading, setIsLoading] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const syncPromiseRef = useRef<Promise<void> | null>(null);
	const syncPromiseScopeRef = useRef<string | null>(null);
	const loadRequestIdRef = useRef(0);
	const selectedScopeKeyRef = useRef<string | null>(selectedScopeKey);

	useEffect(() => {
		selectedScopeKeyRef.current = selectedScopeKey;
	}, [selectedScopeKey]);

	const scopedRecords = dataScopeKey === selectedScopeKey ? records : [];
	const scopedScheduleItems = dataScopeKey === selectedScopeKey ? scheduleItems : [];
	const scopedScheduleProfile = dataScopeKey === selectedScopeKey ? scheduleProfile : "US_CDC";

	const reloadLocalImmunizations = useCallback(async () => {
		if (!session || !selectedBaby) {
			setDataScopeKey(selectedScopeKey);
			setRecords([]);
			setScheduleItems([]);
			setScheduleProfile("US_CDC");
			setSyncError(null);
			return;
		}

		const scopeKey = getImmunizationScopeKey(session.user.id, selectedBaby.id);
		const cached = await loadCachedImmunizations(session.user.id, selectedBaby.id);

		if (selectedScopeKeyRef.current !== scopeKey) {
			return;
		}

		setDataScopeKey(scopeKey);
		setRecords(cached.records.sort(sortRecordsDescending));
		setScheduleItems(cached.scheduleItems);
		setScheduleProfile(cached.scheduleProfile);
	}, [selectedBaby, session]);

	const syncPendingImmunizationMutations = useCallback(async () => {
		if (!session || !selectedBaby) return;

		if (authStatus === "authRequiredForSync") {
			setSyncError("Sync paused. Sign in again to sync changes.");
			return;
		}

		const scopeKey = getImmunizationScopeKey(session.user.id, selectedBaby.id);

		if (syncPromiseRef.current && syncPromiseScopeRef.current === scopeKey) {
			return syncPromiseRef.current;
		}

		if (syncPromiseRef.current) {
			return;
		}

		syncPromiseScopeRef.current = scopeKey;
		syncPromiseRef.current = (async () => {
			const mutations = await loadPendingImmunizationMutations(session.user.id, selectedBaby.id);
			let hadTransientError = false;

			for (const mutation of mutations) {
				try {
					if (mutation.operation === "create") {
						const response = await createImmunizationRecordApi(
							mutation.babyId,
							mutation.payload as ImmunizationRecordInput,
						);

						if (mutation.localId) {
							await replaceLocalImmunizationId({
								babyId: mutation.babyId,
								localId: mutation.localId,
								record: response.record,
								userId: mutation.userId,
							});
						} else {
							await upsertLocalImmunizationRecord({
								babyId: mutation.babyId,
								record: response.record,
								syncStatus: "synced",
								userId: mutation.userId,
							});
						}
					} else if (mutation.operation === "update") {
						if (!mutation.recordId) {
							throw new Error("Missing immunization record id for queued update.");
						}

						const response = await updateImmunizationRecordApi(
							mutation.babyId,
							mutation.recordId,
							mutation.payload as ImmunizationRecordInput,
						);
						await upsertLocalImmunizationRecord({
							babyId: mutation.babyId,
							record: response.record,
							syncStatus: "synced",
							userId: mutation.userId,
						});
					} else if (mutation.operation === "delete") {
						if (!mutation.recordId) {
							throw new Error("Missing immunization record id for queued delete.");
						}

						await deleteImmunizationRecordApi(mutation.babyId, mutation.recordId);
						await removeImmunizationRecordCache({
							babyId: mutation.babyId,
							recordId: mutation.recordId,
							userId: mutation.userId,
						});
					} else {
						const payload = mutation.payload as { scheduleProfile: ImmunizationScheduleProfile };
						const response = await updateImmunizationProfileApi(
							mutation.babyId,
							payload.scheduleProfile,
						);
						await saveImmunizationPayload({
							babyId: mutation.babyId,
							scheduleItems: response.scheduleItems,
							scheduleProfile: response.scheduleProfile,
							userId: mutation.userId,
						});
					}

					await markImmunizationMutationSynced(mutation.id);
				} catch (error) {
					if (isPermanentSyncError(error)) {
						const message = getErrorMessage(error);
						await markImmunizationMutationFailed(mutation.id, message);

						if (mutation.recordId ?? mutation.localId) {
							const failedId = mutation.recordId ?? mutation.localId;
							setRecords((currentRecords) =>
								selectedScopeKeyRef.current === scopeKey
									? currentRecords.map((record) =>
									record.id === failedId
										? { ...record, syncError: message, syncStatus: "failed" }
										: record,
									)
									: currentRecords,
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
				await reloadLocalImmunizations();
			}
		})();

		try {
			await syncPromiseRef.current;
		} finally {
			syncPromiseRef.current = null;
			syncPromiseScopeRef.current = null;
		}
	}, [authStatus, reloadLocalImmunizations, selectedBaby, session]);

	const loadImmunizations = useCallback(async (options: { sync?: boolean } = {}) => {
		if (!session || !selectedBaby) {
			setDataScopeKey(selectedScopeKey);
			setRecords([]);
			setScheduleItems([]);
			setScheduleProfile("US_CDC");
			setSyncError(null);
			return;
		}

		const requestId = loadRequestIdRef.current + 1;
		loadRequestIdRef.current = requestId;
		const scopeKey = getImmunizationScopeKey(session.user.id, selectedBaby.id);

		setIsLoading(true);

		try {
			await reloadLocalImmunizations();

			if (selectedScopeKeyRef.current !== scopeKey) {
				return;
			}

			if (options.sync) {
				await syncPendingImmunizationMutations();
				const response = await getImmunizations(selectedBaby.id);

				if (selectedScopeKeyRef.current !== scopeKey || loadRequestIdRef.current !== requestId) {
					return;
				}

				await saveImmunizationPayload({
					babyId: selectedBaby.id,
					scheduleItems: response.scheduleItems,
					scheduleProfile: response.scheduleProfile,
					userId: session.user.id,
				});
				await mergeServerImmunizationRecords({
					babyId: selectedBaby.id,
					records: response.records,
					userId: session.user.id,
				});
				await reloadLocalImmunizations();
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
		reloadLocalImmunizations,
		selectedBaby,
		session,
		syncPendingImmunizationMutations,
	]);

	useEffect(() => {
		void loadImmunizations({ sync: false }).catch(reportBackgroundError);
	}, [loadImmunizations]);

	const createImmunizationRecord = useCallback(async (input: ImmunizationRecordInput) => {
		if (!session || !selectedBaby) return false;

		const now = new Date().toISOString();
		const localId = getLocalId();
		const scheduleItem = input.scheduleItemId
			? scopedScheduleItems.find((item) => item.id === input.scheduleItemId)
			: undefined;
		const localRecord: LocalImmunizationRecord = {
			babyId: selectedBaby.id,
			clinicName: normalizeText(input.clinicName),
			createdAt: now,
			doseLabel: normalizeText(input.doseLabel) ?? scheduleItem?.doseLabel ?? null,
			givenDate: input.givenDate,
			id: localId,
			isCustom: !input.scheduleItemId,
			lotNumber: normalizeText(input.lotNumber),
			notes: normalizeText(input.notes),
			providerName: normalizeText(input.providerName),
			scheduleItemId: input.scheduleItemId ?? null,
			syncStatus: "pending",
			updatedAt: now,
			vaccineName: scheduleItem?.vaccineName ?? input.vaccineName?.trim() ?? "Immunization",
		};

		setDataScopeKey(selectedScopeKey);
		setRecords((currentRecords) => [localRecord, ...currentRecords].sort(sortRecordsDescending));
		await upsertLocalImmunizationRecord({
			babyId: selectedBaby.id,
			record: localRecord,
			syncStatus: "pending",
			userId: session.user.id,
		});
		await enqueueImmunizationMutation({
			babyId: selectedBaby.id,
			id: createUuid(),
			localId,
			operation: "create",
			payload: input,
			status: "pending",
			userId: session.user.id,
		});
		void syncPendingImmunizationMutations();
		return true;
	}, [scopedScheduleItems, selectedBaby, selectedScopeKey, session, syncPendingImmunizationMutations]);

	const updateImmunizationRecord = useCallback(async (recordId: string, input: ImmunizationRecordInput) => {
		if (!session || !selectedBaby) return false;

		const now = new Date().toISOString();
		const existingRecord = scopedRecords.find((record) => record.id === recordId);
		const scheduleItem = input.scheduleItemId
			? scopedScheduleItems.find((item) => item.id === input.scheduleItemId)
			: undefined;

		if (!existingRecord) return false;

		const nextRecord: BabyImmunizationRecord = {
			...existingRecord,
			clinicName: normalizeText(input.clinicName),
			doseLabel: normalizeText(input.doseLabel) ?? scheduleItem?.doseLabel ?? null,
			givenDate: input.givenDate,
			isCustom: !input.scheduleItemId,
			lotNumber: normalizeText(input.lotNumber),
			notes: normalizeText(input.notes),
			providerName: normalizeText(input.providerName),
			scheduleItemId: input.scheduleItemId ?? null,
			updatedAt: now,
			vaccineName: scheduleItem?.vaccineName ?? input.vaccineName?.trim() ?? existingRecord.vaccineName,
		};

		setDataScopeKey(selectedScopeKey);
		setRecords((currentRecords) =>
			currentRecords
				.map((record) =>
					record.id === recordId
						? { ...nextRecord, syncError: null, syncStatus: "pending" as const }
						: record,
				)
				.sort(sortRecordsDescending),
		);

		await upsertLocalImmunizationRecord({
			babyId: selectedBaby.id,
			record: nextRecord,
			syncStatus: "pending",
			userId: session.user.id,
		});

		if (recordId.startsWith("local:")) {
			await updateQueuedImmunizationCreateByLocalId({
				babyId: selectedBaby.id,
				localId: recordId,
				payload: input,
				userId: session.user.id,
			});
		} else {
			await enqueueImmunizationMutation({
				babyId: selectedBaby.id,
				id: createUuid(),
				operation: "update",
				payload: input,
				recordId,
				status: "pending",
				userId: session.user.id,
			});
		}

		void syncPendingImmunizationMutations();
		return true;
	}, [scopedRecords, scopedScheduleItems, selectedBaby, selectedScopeKey, session, syncPendingImmunizationMutations]);

	const deleteImmunizationRecord = useCallback(async (recordId: string) => {
		if (!session || !selectedBaby) return false;

		setDataScopeKey(selectedScopeKey);
		setRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordId));

		if (recordId.startsWith("local:")) {
			await deleteQueuedImmunizationCreateByLocalId({
				babyId: selectedBaby.id,
				localId: recordId,
				userId: session.user.id,
			});
			await removeImmunizationRecordCache({
				babyId: selectedBaby.id,
				recordId,
				userId: session.user.id,
			});
		} else {
			await markImmunizationRecordDeleted({
				babyId: selectedBaby.id,
				recordId,
				userId: session.user.id,
			});
			await enqueueImmunizationMutation({
				babyId: selectedBaby.id,
				id: createUuid(),
				operation: "delete",
				payload: { givenDate: getDateKey(new Date()), vaccineName: "" },
				recordId,
				status: "pending",
				userId: session.user.id,
			});
		}

		void syncPendingImmunizationMutations();
		return true;
	}, [selectedBaby, selectedScopeKey, session, syncPendingImmunizationMutations]);

	const updateImmunizationProfile = useCallback(async (profile: ImmunizationScheduleProfile) => {
		if (!session || !selectedBaby) return false;

		setDataScopeKey(selectedScopeKey);
		setScheduleProfile(profile);
		if (profile === "CUSTOM") {
			setScheduleItems([]);
		}

		await saveImmunizationPayload({
			babyId: selectedBaby.id,
			scheduleItems: profile === "CUSTOM" ? [] : scopedScheduleItems,
			scheduleProfile: profile,
			userId: session.user.id,
		});
		await enqueueImmunizationMutation({
			babyId: selectedBaby.id,
			id: createUuid(),
			operation: "profile",
			payload: { scheduleProfile: profile },
			status: "pending",
			userId: session.user.id,
		});
		void syncPendingImmunizationMutations();
		return true;
	}, [scopedScheduleItems, selectedBaby, selectedScopeKey, session, syncPendingImmunizationMutations]);

	const value = useMemo<ImmunizationDataContextValue>(() => ({
		createImmunizationRecord,
		deleteImmunizationRecord,
		getImmunizationRecord: (recordId) => scopedRecords.find((record) => record.id === recordId),
		isLoading,
		loadImmunizations,
		records: scopedRecords,
		scheduleItems: scopedScheduleItems,
		scheduleProfile: scopedScheduleProfile,
		syncError,
		syncPendingImmunizationMutations,
		updateImmunizationProfile,
		updateImmunizationRecord,
	}), [
		createImmunizationRecord,
		dataScopeKey,
		deleteImmunizationRecord,
		isLoading,
		loadImmunizations,
		scopedRecords,
		scopedScheduleItems,
		scopedScheduleProfile,
		syncError,
		syncPendingImmunizationMutations,
		updateImmunizationProfile,
		updateImmunizationRecord,
	]);

	return (
		<ImmunizationDataContext.Provider value={value}>
			{children}
		</ImmunizationDataContext.Provider>
	);
}

export function useImmunizationData() {
	const context = useContext(ImmunizationDataContext);

	if (!context) {
		throw new Error("useImmunizationData must be used within ImmunizationDataProvider");
	}

	return context;
}

function sortRecordsDescending(left: BabyImmunizationRecord, right: BabyImmunizationRecord) {
	const byDate = right.givenDate.localeCompare(left.givenDate);

	if (byDate !== 0) {
		return byDate;
	}

	return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function normalizeText(value?: string | null) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function getDateKey(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function getLocalId() {
	return `local:immunization:${createUuid()}`;
}

function getImmunizationScopeKey(userId: string, babyId: string) {
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

	return "Could not sync immunization records.";
}

function isPermanentSyncError(error: unknown) {
	return error instanceof ApiError &&
		error.status >= 400 &&
		error.status < 500 &&
		error.status !== 401 &&
		error.status !== 403;
}
