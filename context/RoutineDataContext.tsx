import type {
	DiaperColor,
	DiaperEvent,
	DiaperType,
	MealEvent,
	MealType,
	RoutineDay,
	RoutineEvent,
	SleepEvent,
	SleepType,
} from "@/data/homeData";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import {
	createRoutineLog,
	deleteRoutineLog,
	type RoutineLastLogged,
	type RoutineMutationResponse,
	updateRoutineLog,
} from "@/services/api/routine";
import { ApiError } from "@/services/api/httpClient";
import {
	deleteQueuedCreateByLocalId,
	enqueueRoutineMutation,
	loadPendingRoutineMutations,
	markRoutineMutationFailed,
	markRoutineMutationSynced,
	saveRoutineHomeCache,
	type QueuedRoutineMutation,
	updateQueuedCreatePayloadByLocalId,
} from "@/services/routine/routineOfflineStore";
import {
	getDateKeyStartMs,
	getLocalDateKey,
	getRoutineEventTime,
	getSleepDurationMinutes,
} from "@/utils/routineDisplay";
import {
	createContext,
	PropsWithChildren,
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

export type AddMealInput = {
	amountServings?: number;
	amountGrams?: number;
	amountMl?: number;
	durationMinutes?: number;
	breastSide?: "left" | "right";
	notes?: string;
	time: string;
	type: MealType;
};

export type AddDiaperInput = {
	color?: DiaperColor;
	notes?: string;
	time: string;
	type: DiaperType;
};

export type UpdateMealInput = AddMealInput & {
	id: string;
};

export type UpdateDiaperInput = AddDiaperInput & {
	id: string;
};

export type AddSleepInput = {
	endTime?: string;
	notes?: string;
	startTime: string;
	type: SleepType;
};

export type UpdateSleepInput = AddSleepInput & {
	id: string;
};

type RoutineDataContextValue = {
	addDiaper: (input: AddDiaperInput) => Promise<boolean>;
	addMeal: (input: AddMealInput) => Promise<boolean>;
	addSleep: (input: AddSleepInput) => Promise<boolean>;
	dailyLogs: RoutineDay[];
	getLatestDiaper: () => DiaperEvent | undefined;
	getLatestMeal: () => MealEvent | undefined;
	getLatestSleep: () => SleepEvent | undefined;
	getOngoingSleep: () => SleepEvent | undefined;
	lastLogged: RoutineLastLogged | null;
	setLastLogged: (lastLogged: RoutineLastLogged | null) => void;
	syncError: string | null;
	syncPendingMutations: () => Promise<void>;
	updateDiaper: (input: UpdateDiaperInput) => Promise<boolean>;
	updateMeal: (input: UpdateMealInput) => Promise<boolean>;
	updateSleep: (input: UpdateSleepInput) => Promise<boolean>;
	prependOlderDailyLogs: (logs: RoutineDay[]) => void;
	removeDiaper: (diaperId: string) => Promise<boolean>;
	removeMeal: (mealId: string) => Promise<boolean>;
	removeSleep: (sleepId: string) => Promise<boolean>;
	replaceDailyLogs: (logs: RoutineDay[]) => void;
};

const RoutineDataContext = createContext<RoutineDataContextValue | undefined>(undefined);
const OFFLINE_SYNC_MESSAGE = "Offline mode. Sync will be re-enabled once online.";

function getEventDate(event: RoutineEvent) {
	return getLocalDateKey(getRoutineEventTime(event));
}

function getEmptyMealsByType(): RoutineDay["summary"]["meals"]["byType"] {
	return {
		breastfeed: { count: 0, totalMinutes: 0 },
		breastMilk: { count: 0, totalAmountMl: 0 },
		formula: { count: 0, totalAmountMl: 0 },
		solid: { count: 0, totalServings: 0, totalGrams: 0 },
	};
}

function createEmptyRoutineDay(date: string): RoutineDay {
	return {
		date,
		summary: {
			diapers: {
				byType: { both: 0, dirty: 0, dry: 0, wet: 0 },
				totalChanges: 0,
			},
			meals: {
				byType: getEmptyMealsByType(),
				totalCount: 0,
			},
			sleep: {
				byType: {
					nap: { count: 0, totalMinutes: 0 },
					nighttime: { count: 0, totalMinutes: 0 },
				},
				totalMinutes: 0,
				totalSessions: 0,
			},
		},
		timeline: [],
	};
}

function applyMealToSummary(day: RoutineDay, meal: MealEvent): RoutineDay["summary"] {
	const mealsByType = {
		...day.summary.meals.byType,
		[meal.type]: { ...day.summary.meals.byType[meal.type] },
	};

	const typeSummary = mealsByType[meal.type];
	typeSummary.count += 1;

	if (meal.type === "breastfeed") {
		typeSummary.totalMinutes = (typeSummary.totalMinutes ?? 0) + (meal.durationMinutes ?? 0);
	} else if (meal.type === "solid") {
		typeSummary.totalServings = (typeSummary.totalServings ?? 0) + (meal.amountServings ?? 0);
		typeSummary.totalGrams = (typeSummary.totalGrams ?? 0) + (meal.amountGrams ?? 0);
	} else {
		typeSummary.totalAmountMl = (typeSummary.totalAmountMl ?? 0) + (meal.amountMl ?? 0);
	}

	return {
		...day.summary,
		meals: {
			byType: mealsByType,
			totalCount: day.summary.meals.totalCount + 1,
		},
	};
}

function removeMealFromSummary(day: RoutineDay, meal: MealEvent): RoutineDay["summary"] {
	const mealsByType = {
		...day.summary.meals.byType,
		[meal.type]: { ...day.summary.meals.byType[meal.type] },
	};

	const typeSummary = mealsByType[meal.type];
	typeSummary.count = Math.max(0, typeSummary.count - 1);

	if (meal.type === "breastfeed") {
		typeSummary.totalMinutes = Math.max(0, (typeSummary.totalMinutes ?? 0) - (meal.durationMinutes ?? 0));
	} else if (meal.type === "solid") {
		typeSummary.totalServings = Math.max(0, (typeSummary.totalServings ?? 0) - (meal.amountServings ?? 0));
		typeSummary.totalGrams = Math.max(0, (typeSummary.totalGrams ?? 0) - (meal.amountGrams ?? 0));
	} else {
		typeSummary.totalAmountMl = Math.max(0, (typeSummary.totalAmountMl ?? 0) - (meal.amountMl ?? 0));
	}

	return {
		...day.summary,
		meals: {
			byType: mealsByType,
			totalCount: Math.max(0, day.summary.meals.totalCount - 1),
		},
	};
}

function applyDiaperToSummary(day: RoutineDay, diaper: DiaperEvent): RoutineDay["summary"] {
	return {
		...day.summary,
		diapers: {
			byType: {
				...day.summary.diapers.byType,
				[diaper.type]: day.summary.diapers.byType[diaper.type] + 1,
			},
			totalChanges: day.summary.diapers.totalChanges + 1,
		},
	};
}

function removeDiaperFromSummary(day: RoutineDay, diaper: DiaperEvent): RoutineDay["summary"] {
	return {
		...day.summary,
		diapers: {
			byType: {
				...day.summary.diapers.byType,
				[diaper.type]: Math.max(0, day.summary.diapers.byType[diaper.type] - 1),
			},
			totalChanges: Math.max(0, day.summary.diapers.totalChanges - 1),
		},
	};
}

function getSleepDurationForSummary(sleep: SleepEvent) {
	if (!sleep.endTime) {
		return 0;
	}

	return getSleepDurationMinutes(sleep.startTime, sleep.endTime);
}

function applySleepToSummary(day: RoutineDay, sleep: SleepEvent): RoutineDay["summary"] {
	const duration = getSleepDurationForSummary(sleep);

	return {
		...day.summary,
		sleep: {
			byType: {
				...day.summary.sleep.byType,
				[sleep.type]: {
					count: day.summary.sleep.byType[sleep.type].count + 1,
					totalMinutes: day.summary.sleep.byType[sleep.type].totalMinutes + duration,
				},
			},
			totalMinutes: day.summary.sleep.totalMinutes + duration,
			totalSessions: day.summary.sleep.totalSessions + 1,
		},
	};
}

function removeSleepFromSummary(day: RoutineDay, sleep: SleepEvent): RoutineDay["summary"] {
	const duration = getSleepDurationForSummary(sleep);

	return {
		...day.summary,
		sleep: {
			byType: {
				...day.summary.sleep.byType,
				[sleep.type]: {
					count: Math.max(0, day.summary.sleep.byType[sleep.type].count - 1),
					totalMinutes: Math.max(0, day.summary.sleep.byType[sleep.type].totalMinutes - duration),
				},
			},
			totalMinutes: Math.max(0, day.summary.sleep.totalMinutes - duration),
			totalSessions: Math.max(0, day.summary.sleep.totalSessions - 1),
		},
	};
}

function sortDaysDescending(a: RoutineDay, b: RoutineDay) {
	return getDateKeyStartMs(b.date) - getDateKeyStartMs(a.date);
}

function sortEventsDescending(a: RoutineEvent, b: RoutineEvent) {
	return new Date(getRoutineEventTime(b)).getTime() - new Date(getRoutineEventTime(a)).getTime();
}

function mergeDailyLogs(currentLogs: RoutineDay[], incomingLogs: RoutineDay[]) {
	const logsByDate = new Map<string, RoutineDay>();

	[...currentLogs, ...incomingLogs].forEach((day) => {
		if (day.timeline.length === 0) {
			logsByDate.delete(day.date);
		} else {
			logsByDate.set(day.date, day);
		}
	});

	return Array.from(logsByDate.values()).sort(sortDaysDescending);
}

function removeEventById(logs: RoutineDay[], eventId: string) {
	return logs
		.map((day) => ({
			...day,
			timeline: day.timeline.filter((event) => event.id !== eventId),
		}))
		.filter((day) => day.timeline.length > 0)
		.sort(sortDaysDescending);
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

function getQueueId() {
	return createUuid();
}

function getLocalId(kind: "meal" | "diaper" | "sleep") {
	return `local:${kind}:${createUuid()}`;
}

function getLastLoggedFromLogs(logs: RoutineDay[]): RoutineLastLogged {
	const events = logs.flatMap((day) => day.timeline);
	const meal = events
		.filter((event): event is MealEvent => event.kind === "meal")
		.sort(sortEventsDescending)[0];
	const diaper = events
		.filter((event): event is DiaperEvent => event.kind === "diaper")
		.sort(sortEventsDescending)[0];
	const activeSleep = events
		.filter((event): event is SleepEvent => event.kind === "sleep" && !event.endTime)
		.sort(sortEventsDescending)[0];
	const completedSleep = events
		.filter((event): event is SleepEvent => event.kind === "sleep" && Boolean(event.endTime))
		.sort(sortEventsDescending)[0];
	const sleep = activeSleep ?? completedSleep;

	return {
		meal: meal ? { time: meal.time, type: meal.type } : null,
		diaper: diaper ? { time: diaper.time, type: diaper.type } : null,
		sleep: sleep
			? {
					id: sleep.id,
					endTime: sleep.endTime ?? null,
					isActive: !sleep.endTime,
					lastLoggedAt: sleep.endTime ?? sleep.startTime,
					startTime: sleep.startTime,
					type: sleep.type,
				}
			: null,
	};
}

function updateMealInLogs(logs: RoutineDay[], input: UpdateMealInput) {
	const existingMeal = logs
		.flatMap((day) => day.timeline)
		.find((event): event is MealEvent => event.kind === "meal" && event.id === input.id);

	if (!existingMeal) return logs;

	const updatedMeal: MealEvent = {
		...existingMeal,
		amountServings: input.type === "solid" ? input.amountServings : undefined,
		amountGrams: input.type === "solid" ? input.amountGrams : undefined,
		amountMl: input.type === "breastMilk" || input.type === "formula" ? input.amountMl : undefined,
		durationMinutes: input.type === "breastfeed" ? input.durationMinutes : undefined,
		breastSide: input.type === "breastfeed" ? input.breastSide : undefined,
		notes: input.notes?.trim() ? input.notes.trim() : undefined,
		syncStatus: "pending",
		time: input.time,
		type: input.type,
	};

	return replaceEventInLogs(logs, existingMeal, updatedMeal);
}

function updateDiaperInLogs(logs: RoutineDay[], input: UpdateDiaperInput) {
	const existingDiaper = logs
		.flatMap((day) => day.timeline)
		.find((event): event is DiaperEvent => event.kind === "diaper" && event.id === input.id);

	if (!existingDiaper) return logs;

	const updatedDiaper: DiaperEvent = {
		...existingDiaper,
		color: input.type === "dirty" || input.type === "both" ? input.color : undefined,
		notes: input.notes?.trim() ? input.notes.trim() : undefined,
		syncStatus: "pending",
		time: input.time,
		type: input.type,
	};

	return replaceEventInLogs(logs, existingDiaper, updatedDiaper);
}

function updateSleepInLogs(logs: RoutineDay[], input: UpdateSleepInput) {
	const existingSleep = logs
		.flatMap((day) => day.timeline)
		.find((event): event is SleepEvent => event.kind === "sleep" && event.id === input.id);

	if (!existingSleep) return logs;

	const updatedSleep: SleepEvent = {
		...existingSleep,
		endTime: input.endTime,
		notes: input.notes?.trim() ? input.notes.trim() : undefined,
		startTime: input.startTime,
		syncStatus: "pending",
		type: input.type,
	};

	return replaceEventInLogs(logs, existingSleep, updatedSleep);
}

function replaceEventInLogs(logs: RoutineDay[], previous: RoutineEvent, next: RoutineEvent) {
	const previousDate = getEventDate(previous);
	const nextDate = getEventDate(next);
	const hasNextDay = logs.some((day) => day.date === nextDate);
	const nextLogs = hasNextDay ? logs : [createEmptyRoutineDay(nextDate), ...logs];

	return nextLogs
		.map((day) => {
			let nextDay = day;

			if (day.date === previousDate) {
				nextDay = removeEventFromDaySummary(nextDay, previous);
				nextDay = {
					...nextDay,
					timeline: nextDay.timeline.filter((event) => event.id !== previous.id),
				};
			}

			if (day.date === nextDate) {
				nextDay = applyEventToDaySummary(nextDay, next);
				nextDay = {
					...nextDay,
					timeline: [...nextDay.timeline, next].sort(sortEventsDescending),
				};
			}

			return nextDay;
		})
		.filter((day) => day.timeline.length > 0)
		.sort(sortDaysDescending);
}

function removeEventFromDaySummary(day: RoutineDay, event: RoutineEvent) {
	if (event.kind === "meal") return { ...day, summary: removeMealFromSummary(day, event) };
	if (event.kind === "diaper") return { ...day, summary: removeDiaperFromSummary(day, event) };
	return { ...day, summary: removeSleepFromSummary(day, event) };
}

function applyEventToDaySummary(day: RoutineDay, event: RoutineEvent) {
	if (event.kind === "meal") return { ...day, summary: applyMealToSummary(day, event) };
	if (event.kind === "diaper") return { ...day, summary: applyDiaperToSummary(day, event) };
	return { ...day, summary: applySleepToSummary(day, event) };
}

export function RoutineDataProvider({ children }: PropsWithChildren) {
	const { authStatus, session } = useAuthSession();
	const { selectedBaby } = useBabySelection();
	const [dailyLogs, setDailyLogs] = useState<RoutineDay[]>([]);
	const [lastLogged, setLastLogged] = useState<RoutineLastLogged | null>(null);
	const [syncError, setSyncError] = useState<string | null>(null);
	const syncPromiseRef = useRef<Promise<void> | null>(null);
	const replaceDailyLogs = useCallback((logs: RoutineDay[]) => {
		setDailyLogs([...logs].sort(sortDaysDescending));
	}, []);

	const prependOlderDailyLogs = useCallback((logs: RoutineDay[]) => {
		setDailyLogs((currentLogs) => mergeDailyLogs(currentLogs, logs));
	}, []);

	const applyMutationResult = useCallback((logs: RoutineDay[], nextLastLogged: RoutineLastLogged) => {
		setDailyLogs((currentLogs) => mergeDailyLogs(currentLogs, logs));
		setLastLogged(nextLastLogged);
	}, []);

	const persistRoutineCache = useCallback((logs: RoutineDay[], nextLastLogged: RoutineLastLogged | null) => {
		if (!session || !selectedBaby) return;
		if (logs.length === 0 && nextLastLogged === null) return;

		void saveRoutineHomeCache({
			babyId: selectedBaby.id,
			dailyLogs: logs,
			lastLogged: nextLastLogged,
			userId: session.user.id,
		}).catch(reportBackgroundError);
	}, [selectedBaby, session]);

	useEffect(() => {
		persistRoutineCache(dailyLogs, lastLogged);
	}, [dailyLogs, lastLogged, persistRoutineCache]);

	const syncQueuedMutations = useCallback(async () => {
		if (!session || !selectedBaby) return;

		if (authStatus === "authRequiredForSync") {
			setSyncError("Sync paused. Sign in again to sync changes.");
			return;
		}

		if (syncPromiseRef.current) {
			return syncPromiseRef.current;
		}

		syncPromiseRef.current = (async () => {
			const mutations = await loadPendingRoutineMutations(session.user.id, selectedBaby.id);
			let hadTransientError = false;

			for (const mutation of mutations) {
				try {
					const response = await sendQueuedMutation(mutation);
					await markRoutineMutationSynced(mutation.id);

					setDailyLogs((currentLogs) => {
						const withoutLocal = mutation.localId
							? removeEventById(currentLogs, mutation.localId)
							: currentLogs;
						return mergeDailyLogs(withoutLocal, response.affectedDailyLogs);
					});
					setLastLogged(response.lastLogged);
				} catch (error) {
					if (isPermanentSyncError(error)) {
						await markRoutineMutationFailed(mutation.id, getErrorMessage(error));
					} else {
						hadTransientError = true;
						setSyncError(OFFLINE_SYNC_MESSAGE);
					}
				}
			}

			if (!hadTransientError) {
				setSyncError(null);
			}
		})();

		try {
			await syncPromiseRef.current;
		} finally {
			syncPromiseRef.current = null;
		}
	}, [authStatus, selectedBaby, session]);

	const value = useMemo<RoutineDataContextValue>(() => {
		const getLatestMeal = () =>
			dailyLogs
				.flatMap((day) => day.timeline)
				.filter((event): event is MealEvent => event.kind === "meal")
				.sort(sortEventsDescending)[0];

		const getLatestDiaper = () =>
			dailyLogs
				.flatMap((day) => day.timeline)
				.filter((event): event is DiaperEvent => event.kind === "diaper")
				.sort(sortEventsDescending)[0];

		const getLatestSleep = () =>
			dailyLogs
				.flatMap((day) => day.timeline)
				.filter((event): event is SleepEvent => event.kind === "sleep")
				.sort(sortEventsDescending)[0];

		const getOngoingSleep = () =>
			dailyLogs
				.flatMap((day) => day.timeline)
				.filter((event): event is SleepEvent => event.kind === "sleep" && !event.endTime)
				.sort(sortEventsDescending)[0];

		const addMeal = async (input: AddMealInput) => {
			if (!selectedBaby || !session) return false;

			const localId = getLocalId("meal");
			const clientMutationId = createUuid();
			const payload = {
				...input,
				clientMutationId,
				kind: "meal",
			} as const;
			const meal: MealEvent = {
				amountServings: input.type === "solid" ? input.amountServings : undefined,
				amountGrams: input.type === "solid" ? input.amountGrams : undefined,
				amountMl: input.type === "breastMilk" || input.type === "formula" ? input.amountMl : undefined,
				durationMinutes: input.type === "breastfeed" ? input.durationMinutes : undefined,
				breastSide: input.type === "breastfeed" ? input.breastSide : undefined,
				id: localId,
				kind: "meal",
				notes: input.notes?.trim() ? input.notes.trim() : undefined,
				syncStatus: "pending",
				time: input.time,
				type: input.type,
			};
			const mealDate = getEventDate(meal);

			setDailyLogs((currentLogs) => {
				const hasDay = currentLogs.some((day) => day.date === mealDate);
				const logs = hasDay ? currentLogs : [createEmptyRoutineDay(mealDate), ...currentLogs];

				const nextLogs = logs
					.map((day) => day.date === mealDate
						? {
								...day,
								summary: applyMealToSummary(day, meal),
								timeline: [...day.timeline, meal].sort(sortEventsDescending),
							}
						: day)
					.sort(sortDaysDescending);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});
			await enqueueRoutineMutation({
				babyId: selectedBaby.id,
				clientMutationId,
				id: getQueueId(),
				kind: "meal",
				localId,
				operation: "create",
				payload,
				status: "pending",
				userId: session.user.id,
			});
			void syncQueuedMutations();
			return true;
		};

		const addSleep = async (input: AddSleepInput) => {
			if (!selectedBaby || !session) return false;

			const localId = getLocalId("sleep");
			const clientMutationId = createUuid();
			const payload = {
				...input,
				clientMutationId,
				kind: "sleep",
			} as const;
			const sleep: SleepEvent = {
				endTime: input.endTime,
				id: localId,
				kind: "sleep",
				notes: input.notes?.trim() ? input.notes.trim() : undefined,
				startTime: input.startTime,
				syncStatus: "pending",
				type: input.type,
			};
			const sleepDate = getEventDate(sleep);

			setDailyLogs((currentLogs) => {
				const hasDay = currentLogs.some((day) => day.date === sleepDate);
				const logs = hasDay ? currentLogs : [createEmptyRoutineDay(sleepDate), ...currentLogs];

				const nextLogs = logs
					.map((day) => day.date === sleepDate
						? {
								...day,
								summary: applySleepToSummary(day, sleep),
								timeline: [...day.timeline, sleep].sort(sortEventsDescending),
							}
						: day)
					.sort(sortDaysDescending);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});
			await enqueueRoutineMutation({
				babyId: selectedBaby.id,
				clientMutationId,
				id: getQueueId(),
				kind: "sleep",
				localId,
				operation: "create",
				payload,
				status: "pending",
				userId: session.user.id,
			});
			void syncQueuedMutations();
			return true;
		};

		const addDiaper = async (input: AddDiaperInput) => {
			if (!selectedBaby || !session) return false;

			const localId = getLocalId("diaper");
			const clientMutationId = createUuid();
			const payload = {
				...input,
				clientMutationId,
				kind: "diaper",
			} as const;
			const diaper: DiaperEvent = {
				color: input.type === "dirty" || input.type === "both" ? input.color : undefined,
				id: localId,
				kind: "diaper",
				notes: input.notes?.trim() ? input.notes.trim() : undefined,
				syncStatus: "pending",
				time: input.time,
				type: input.type,
			};
			const diaperDate = getEventDate(diaper);

			setDailyLogs((currentLogs) => {
				const hasDay = currentLogs.some((day) => day.date === diaperDate);
				const logs = hasDay ? currentLogs : [createEmptyRoutineDay(diaperDate), ...currentLogs];

				const nextLogs = logs
					.map((day) => day.date === diaperDate
						? {
								...day,
								summary: applyDiaperToSummary(day, diaper),
								timeline: [...day.timeline, diaper].sort(sortEventsDescending),
							}
						: day)
					.sort(sortDaysDescending);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});
			await enqueueRoutineMutation({
				babyId: selectedBaby.id,
				clientMutationId,
				id: getQueueId(),
				kind: "diaper",
				localId,
				operation: "create",
				payload,
				status: "pending",
				userId: session.user.id,
			});
			void syncQueuedMutations();
			return true;
		};

		const updateMeal = async (input: UpdateMealInput) => {
			if (!selectedBaby || !session) return false;

			const { id, ...payload } = input;
			setDailyLogs((currentLogs) => {
				const nextLogs = updateMealInLogs(currentLogs, input);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});

			if (id.startsWith("local:")) {
				await updateQueuedCreatePayloadByLocalId(session.user.id, selectedBaby.id, id, {
					...payload,
					clientMutationId: createUuid(),
					kind: "meal",
				});
			} else {
				await enqueueRoutineMutation({
					babyId: selectedBaby.id,
					eventId: id,
					id: getQueueId(),
					kind: "meal",
					operation: "update",
					payload,
					status: "pending",
					userId: session.user.id,
				});
			}
			void syncQueuedMutations();
			return true;
		};

		const updateDiaper = async (input: UpdateDiaperInput) => {
			if (!selectedBaby || !session) return false;

			const { id, ...payload } = input;
			setDailyLogs((currentLogs) => {
				const nextLogs = updateDiaperInLogs(currentLogs, input);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});

			if (id.startsWith("local:")) {
				await updateQueuedCreatePayloadByLocalId(session.user.id, selectedBaby.id, id, {
					...payload,
					clientMutationId: createUuid(),
					kind: "diaper",
				});
			} else {
				await enqueueRoutineMutation({
					babyId: selectedBaby.id,
					eventId: id,
					id: getQueueId(),
					kind: "diaper",
					operation: "update",
					payload,
					status: "pending",
					userId: session.user.id,
				});
			}
			void syncQueuedMutations();
			return true;
		};

		const updateSleep = async (input: UpdateSleepInput) => {
			if (!selectedBaby || !session) return false;

			const { id, ...payload } = input;
			setDailyLogs((currentLogs) => {
				const nextLogs = updateSleepInLogs(currentLogs, input);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});

			if (id.startsWith("local:")) {
				await updateQueuedCreatePayloadByLocalId(session.user.id, selectedBaby.id, id, {
					...payload,
					clientMutationId: createUuid(),
					kind: "sleep",
				});
			} else {
				await enqueueRoutineMutation({
					babyId: selectedBaby.id,
					eventId: id,
					id: getQueueId(),
					kind: "sleep",
					operation: "update",
					payload,
					status: "pending",
					userId: session.user.id,
				});
			}
			void syncQueuedMutations();
			return true;
		};

		const removeMeal = async (mealId: string) => {
			if (!selectedBaby || !session) return false;

			setDailyLogs((currentLogs) => {
				const nextLogs = removeEventById(currentLogs, mealId);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});

			if (mealId.startsWith("local:")) {
				await deleteQueuedCreateByLocalId(session.user.id, selectedBaby.id, mealId);
			} else {
				await enqueueRoutineMutation({
					babyId: selectedBaby.id,
					eventId: mealId,
					id: getQueueId(),
					kind: "meal",
					operation: "delete",
					payload: {},
					status: "pending",
					userId: session.user.id,
				});
			}
			void syncQueuedMutations();
			return true;
		};

		const removeDiaper = async (diaperId: string) => {
			if (!selectedBaby || !session) return false;

			setDailyLogs((currentLogs) => {
				const nextLogs = removeEventById(currentLogs, diaperId);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});

			if (diaperId.startsWith("local:")) {
				await deleteQueuedCreateByLocalId(session.user.id, selectedBaby.id, diaperId);
			} else {
				await enqueueRoutineMutation({
					babyId: selectedBaby.id,
					eventId: diaperId,
					id: getQueueId(),
					kind: "diaper",
					operation: "delete",
					payload: {},
					status: "pending",
					userId: session.user.id,
				});
			}
			void syncQueuedMutations();
			return true;
		};

		const removeSleep = async (sleepId: string) => {
			if (!selectedBaby || !session) return false;

			setDailyLogs((currentLogs) => {
				const nextLogs = removeEventById(currentLogs, sleepId);
				setLastLogged(getLastLoggedFromLogs(nextLogs));
				return nextLogs;
			});

			if (sleepId.startsWith("local:")) {
				await deleteQueuedCreateByLocalId(session.user.id, selectedBaby.id, sleepId);
			} else {
				await enqueueRoutineMutation({
					babyId: selectedBaby.id,
					eventId: sleepId,
					id: getQueueId(),
					kind: "sleep",
					operation: "delete",
					payload: {},
					status: "pending",
					userId: session.user.id,
				});
			}
			void syncQueuedMutations();
			return true;
		};

		return {
			addDiaper,
			addMeal,
			addSleep,
			dailyLogs,
			getLatestDiaper,
			getLatestMeal,
			getLatestSleep,
			getOngoingSleep,
			lastLogged,
			prependOlderDailyLogs,
			setLastLogged,
			syncError,
			syncPendingMutations: syncQueuedMutations,
			updateDiaper,
			updateMeal,
			updateSleep,
			removeDiaper,
			removeMeal,
			removeSleep,
			replaceDailyLogs,
		};
	}, [
		dailyLogs,
		lastLogged,
		prependOlderDailyLogs,
		replaceDailyLogs,
		selectedBaby,
		session,
		syncError,
		syncQueuedMutations,
	]);

	return <RoutineDataContext.Provider value={value}>{children}</RoutineDataContext.Provider>;
}

export function useRoutineData() {
	const context = useContext(RoutineDataContext);

	if (!context) {
		throw new Error("useRoutineData must be used within RoutineDataProvider");
	}

	return context;
}

async function sendQueuedMutation(mutation: QueuedRoutineMutation): Promise<RoutineMutationResponse> {
	if (mutation.operation === "create") {
		return createRoutineLog(
			mutation.babyId,
			mutation.payload as Parameters<typeof createRoutineLog>[1],
		);
	}

	if (!mutation.eventId) {
		throw new Error("Missing routine event id for queued mutation.");
	}

	if (mutation.operation === "update") {
		return updateRoutineLog(
			mutation.babyId,
			mutation.kind,
			mutation.eventId,
			mutation.payload as Parameters<typeof updateRoutineLog>[3],
		);
	}

	return deleteRoutineLog(mutation.babyId, mutation.kind, mutation.eventId);
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not sync routine change.";
}

function isPermanentSyncError(error: unknown) {
	return error instanceof ApiError &&
		error.status >= 400 &&
		error.status < 500 &&
		error.status !== 401;
}
