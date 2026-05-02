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
import { homeMockApiResponse } from "@/data/mockAPI/homeAPI";
import {
	getDateKeyStartMs,
	getLocalDateKey,
	getRoutineEventTime,
	getSleepDurationMinutes,
} from "@/utils/routineDisplay";
import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

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
	addDiaper: (input: AddDiaperInput) => void;
	addMeal: (input: AddMealInput) => void;
	addSleep: (input: AddSleepInput) => void;
	dailyLogs: RoutineDay[];
	getLatestDiaper: () => DiaperEvent | undefined;
	getLatestMeal: () => MealEvent | undefined;
	getLatestSleep: () => SleepEvent | undefined;
	getOngoingSleep: () => SleepEvent | undefined;
	updateDiaper: (input: UpdateDiaperInput) => void;
	updateMeal: (input: UpdateMealInput) => void;
	updateSleep: (input: UpdateSleepInput) => void;
	removeDiaper: (diaperId: string) => void;
	removeMeal: (mealId: string) => void;
	removeSleep: (sleepId: string) => void;
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

export function RoutineDataProvider({ children }: PropsWithChildren) {
	const [dailyLogs, setDailyLogs] = useState<RoutineDay[]>(homeMockApiResponse.dailyLogs);

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

		const addMeal = (input: AddMealInput) => {
			const meal: MealEvent = {
				amountBowl: input.type === "solid" ? input.amountBowl : undefined,
				amountMl: input.type === "breastMilk" || input.type === "formula" ? input.amountMl : undefined,
				durationMinutes: input.type === "breastfeed" ? input.durationMinutes : undefined,
				id: `meal-${Date.now()}`,
				kind: "meal",
				notes: input.notes?.trim() ? input.notes.trim() : undefined,
				time: input.time,
				type: input.type,
			};
			const mealDate = getEventDate(meal);

			setDailyLogs((currentLogs) => {
				const hasDay = currentLogs.some((day) => day.date === mealDate);
				const logs = hasDay ? currentLogs : [createEmptyRoutineDay(mealDate), ...currentLogs];

				return logs
					.map((day) => {
						if (day.date !== mealDate) {
							return day;
						}

						return {
							...day,
							summary: applyMealToSummary(day, meal),
							timeline: [...day.timeline, meal].sort(sortEventsDescending),
						};
					})
					.sort(sortDaysDescending);
			});
		};

		const addSleep = (input: AddSleepInput) => {
			const sleep: SleepEvent = {
				endTime: input.endTime,
				id: `sleep-${Date.now()}`,
				kind: "sleep",
				notes: input.notes?.trim() ? input.notes.trim() : undefined,
				startTime: input.startTime,
				type: input.type,
			};
			const sleepDate = getEventDate(sleep);

			setDailyLogs((currentLogs) => {
				const hasDay = currentLogs.some((day) => day.date === sleepDate);
				const logs = hasDay ? currentLogs : [createEmptyRoutineDay(sleepDate), ...currentLogs];

				return logs
					.map((day) => {
						if (day.date !== sleepDate) {
							return day;
						}

						return {
							...day,
							summary: applySleepToSummary(day, sleep),
							timeline: [...day.timeline, sleep].sort(sortEventsDescending),
						};
					})
					.sort(sortDaysDescending);
			});
		};

		const addDiaper = (input: AddDiaperInput) => {
			const diaper: DiaperEvent = {
				color: input.type === "dirty" || input.type === "both" ? input.color : undefined,
				id: `diaper-${Date.now()}`,
				kind: "diaper",
				notes: input.notes?.trim() ? input.notes.trim() : undefined,
				time: input.time,
				type: input.type,
			};
			const diaperDate = getEventDate(diaper);

			setDailyLogs((currentLogs) => {
				const hasDay = currentLogs.some((day) => day.date === diaperDate);
				const logs = hasDay ? currentLogs : [createEmptyRoutineDay(diaperDate), ...currentLogs];

				return logs
					.map((day) => {
						if (day.date !== diaperDate) {
							return day;
						}

						return {
							...day,
							summary: applyDiaperToSummary(day, diaper),
							timeline: [...day.timeline, diaper].sort(sortEventsDescending),
						};
					})
					.sort(sortDaysDescending);
			});
		};

		const updateMeal = (input: UpdateMealInput) => {
			setDailyLogs((currentLogs) => {
				const existingMeal = currentLogs
					.flatMap((day) => day.timeline)
					.find((event): event is MealEvent => event.kind === "meal" && event.id === input.id);

				if (!existingMeal) {
					return currentLogs;
				}

				const updatedMeal: MealEvent = {
					...existingMeal,
					amountBowl: input.type === "solid" ? input.amountBowl : undefined,
					amountMl: input.type === "breastMilk" || input.type === "formula" ? input.amountMl : undefined,
					durationMinutes: input.type === "breastfeed" ? input.durationMinutes : undefined,
					notes: input.notes?.trim() ? input.notes.trim() : undefined,
					time: input.time,
					type: input.type,
				};
				const previousDate = getEventDate(existingMeal);
				const nextDate = getEventDate(updatedMeal);
				const hasNextDay = currentLogs.some((day) => day.date === nextDate);
				const logs = hasNextDay ? currentLogs : [createEmptyRoutineDay(nextDate), ...currentLogs];

				return logs
					.map((day) => {
						let nextDay = day;

						if (day.date === previousDate) {
							nextDay = {
								...nextDay,
								summary: removeMealFromSummary(nextDay, existingMeal),
								timeline: nextDay.timeline.filter((event) => event.id !== existingMeal.id),
							};
						}

						if (day.date === nextDate) {
							nextDay = {
								...nextDay,
								summary: applyMealToSummary(nextDay, updatedMeal),
								timeline: [...nextDay.timeline, updatedMeal].sort(sortEventsDescending),
							};
						}

						return nextDay;
					})
					.sort(sortDaysDescending);
			});
		};

		const updateDiaper = (input: UpdateDiaperInput) => {
			setDailyLogs((currentLogs) => {
				const existingDiaper = currentLogs
					.flatMap((day) => day.timeline)
					.find((event): event is DiaperEvent => event.kind === "diaper" && event.id === input.id);

				if (!existingDiaper) {
					return currentLogs;
				}

				const updatedDiaper: DiaperEvent = {
					...existingDiaper,
					color: input.type === "dirty" || input.type === "both" ? input.color : undefined,
					notes: input.notes?.trim() ? input.notes.trim() : undefined,
					time: input.time,
					type: input.type,
				};
				const previousDate = getEventDate(existingDiaper);
				const nextDate = getEventDate(updatedDiaper);
				const hasNextDay = currentLogs.some((day) => day.date === nextDate);
				const logs = hasNextDay ? currentLogs : [createEmptyRoutineDay(nextDate), ...currentLogs];

				return logs
					.map((day) => {
						let nextDay = day;

						if (day.date === previousDate) {
							nextDay = {
								...nextDay,
								summary: removeDiaperFromSummary(nextDay, existingDiaper),
								timeline: nextDay.timeline.filter((event) => event.id !== existingDiaper.id),
							};
						}

						if (day.date === nextDate) {
							nextDay = {
								...nextDay,
								summary: applyDiaperToSummary(nextDay, updatedDiaper),
								timeline: [...nextDay.timeline, updatedDiaper].sort(sortEventsDescending),
							};
						}

						return nextDay;
					})
					.sort(sortDaysDescending);
			});
		};

		const updateSleep = (input: UpdateSleepInput) => {
			setDailyLogs((currentLogs) => {
				const existingSleep = currentLogs
					.flatMap((day) => day.timeline)
					.find((event): event is SleepEvent => event.kind === "sleep" && event.id === input.id);

				if (!existingSleep) {
					return currentLogs;
				}

				const updatedSleep: SleepEvent = {
					...existingSleep,
					endTime: input.endTime,
					notes: input.notes?.trim() ? input.notes.trim() : undefined,
					startTime: input.startTime,
					type: input.type,
				};
				const previousDate = getEventDate(existingSleep);
				const nextDate = getEventDate(updatedSleep);
				const hasNextDay = currentLogs.some((day) => day.date === nextDate);
				const logs = hasNextDay ? currentLogs : [createEmptyRoutineDay(nextDate), ...currentLogs];

				return logs
					.map((day) => {
						let nextDay = day;

						if (day.date === previousDate) {
							nextDay = {
								...nextDay,
								summary: removeSleepFromSummary(nextDay, existingSleep),
								timeline: nextDay.timeline.filter((event) => event.id !== existingSleep.id),
							};
						}

						if (day.date === nextDate) {
							nextDay = {
								...nextDay,
								summary: applySleepToSummary(nextDay, updatedSleep),
								timeline: [...nextDay.timeline, updatedSleep].sort(sortEventsDescending),
							};
						}

						return nextDay;
					})
					.sort(sortDaysDescending);
			});
		};

		const removeMeal = (mealId: string) => {
			setDailyLogs((currentLogs) => {
				const existingMeal = currentLogs
					.flatMap((day) => day.timeline)
					.find((event): event is MealEvent => event.kind === "meal" && event.id === mealId);

				if (!existingMeal) {
					return currentLogs;
				}

				const mealDate = getEventDate(existingMeal);

				return currentLogs
					.map((day) => {
						if (day.date !== mealDate) {
							return day;
						}

						return {
							...day,
							summary: removeMealFromSummary(day, existingMeal),
							timeline: day.timeline.filter((event) => event.id !== existingMeal.id),
						};
					})
					.sort(sortDaysDescending);
			});
		};

		const removeDiaper = (diaperId: string) => {
			setDailyLogs((currentLogs) => {
				const existingDiaper = currentLogs
					.flatMap((day) => day.timeline)
					.find((event): event is DiaperEvent => event.kind === "diaper" && event.id === diaperId);

				if (!existingDiaper) {
					return currentLogs;
				}

				const diaperDate = getEventDate(existingDiaper);

				return currentLogs
					.map((day) => {
						if (day.date !== diaperDate) {
							return day;
						}

						return {
							...day,
							summary: removeDiaperFromSummary(day, existingDiaper),
							timeline: day.timeline.filter((event) => event.id !== existingDiaper.id),
						};
					})
					.sort(sortDaysDescending);
			});
		};

		const removeSleep = (sleepId: string) => {
			setDailyLogs((currentLogs) => {
				const existingSleep = currentLogs
					.flatMap((day) => day.timeline)
					.find((event): event is SleepEvent => event.kind === "sleep" && event.id === sleepId);

				if (!existingSleep) {
					return currentLogs;
				}

				const sleepDate = getEventDate(existingSleep);

				return currentLogs
					.map((day) => {
						if (day.date !== sleepDate) {
							return day;
						}

						return {
							...day,
							summary: removeSleepFromSummary(day, existingSleep),
							timeline: day.timeline.filter((event) => event.id !== existingSleep.id),
						};
					})
					.sort(sortDaysDescending);
			});
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
			updateDiaper,
			updateMeal,
			updateSleep,
			removeDiaper,
			removeMeal,
			removeSleep,
		};
	}, [dailyLogs]);

	return <RoutineDataContext.Provider value={value}>{children}</RoutineDataContext.Provider>;
}

export function useRoutineData() {
	const context = useContext(RoutineDataContext);

	if (!context) {
		throw new Error("useRoutineData must be used within RoutineDataProvider");
	}

	return context;
}
