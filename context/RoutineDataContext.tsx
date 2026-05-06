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
import { useBabySelection } from "@/context/BabySelectionContext";
import {
	createRoutineLog,
	deleteRoutineLog,
	type RoutineLastLogged,
	updateRoutineLog,
} from "@/services/api/routine";
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
	useMemo,
	useState,
} from "react";

export type AddMealInput = {
	amountBowl?: number;
	amountMl?: number;
	durationMinutes?: number;
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

function getEventDate(event: RoutineEvent) {
	return getLocalDateKey(getRoutineEventTime(event));
}

function getEmptyMealsByType(): RoutineDay["summary"]["meals"]["byType"] {
	return {
		breastfeed: { count: 0, totalMinutes: 0 },
		breastMilk: { count: 0, totalAmountMl: 0 },
		formula: { count: 0, totalAmountMl: 0 },
		solid: { count: 0, totalBowls: 0 },
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
		typeSummary.totalBowls = (typeSummary.totalBowls ?? 0) + (meal.amountBowl ?? 0);
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
		typeSummary.totalBowls = Math.max(0, (typeSummary.totalBowls ?? 0) - (meal.amountBowl ?? 0));
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

export function RoutineDataProvider({ children }: PropsWithChildren) {
	const { selectedBaby } = useBabySelection();
	const [dailyLogs, setDailyLogs] = useState<RoutineDay[]>([]);
	const [lastLogged, setLastLogged] = useState<RoutineLastLogged | null>(null);
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
			if (!selectedBaby) return false;

			const response = await createRoutineLog(selectedBaby.id, {
				...input,
				kind: "meal",
			});
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const addSleep = async (input: AddSleepInput) => {
			if (!selectedBaby) return false;

			const response = await createRoutineLog(selectedBaby.id, {
				...input,
				kind: "sleep",
			});
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const addDiaper = async (input: AddDiaperInput) => {
			if (!selectedBaby) return false;

			const response = await createRoutineLog(selectedBaby.id, {
				...input,
				kind: "diaper",
			});
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const updateMeal = async (input: UpdateMealInput) => {
			if (!selectedBaby) return false;

			const { id, ...payload } = input;
			const response = await updateRoutineLog(selectedBaby.id, "meal", id, payload);
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const updateDiaper = async (input: UpdateDiaperInput) => {
			if (!selectedBaby) return false;

			const { id, ...payload } = input;
			const response = await updateRoutineLog(selectedBaby.id, "diaper", id, payload);
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const updateSleep = async (input: UpdateSleepInput) => {
			if (!selectedBaby) return false;

			const { id, ...payload } = input;
			const response = await updateRoutineLog(selectedBaby.id, "sleep", id, payload);
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const removeMeal = async (mealId: string) => {
			if (!selectedBaby) return false;

			const response = await deleteRoutineLog(selectedBaby.id, "meal", mealId);
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const removeDiaper = async (diaperId: string) => {
			if (!selectedBaby) return false;

			const response = await deleteRoutineLog(selectedBaby.id, "diaper", diaperId);
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
			return true;
		};

		const removeSleep = async (sleepId: string) => {
			if (!selectedBaby) return false;

			const response = await deleteRoutineLog(selectedBaby.id, "sleep", sleepId);
			applyMutationResult(response.affectedDailyLogs, response.lastLogged);
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
			updateDiaper,
			updateMeal,
			updateSleep,
			removeDiaper,
			removeMeal,
			removeSleep,
			replaceDailyLogs,
		};
	}, [applyMutationResult, dailyLogs, lastLogged, prependOlderDailyLogs, replaceDailyLogs, selectedBaby]);

	return <RoutineDataContext.Provider value={value}>{children}</RoutineDataContext.Provider>;
}

export function useRoutineData() {
	const context = useContext(RoutineDataContext);

	if (!context) {
		throw new Error("useRoutineData must be used within RoutineDataProvider");
	}

	return context;
}
