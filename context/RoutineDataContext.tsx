import type { MealEvent, MealType, RoutineDay, RoutineEvent } from "@/data/homeData";
import { homeMockApiResponse } from "@/data/mockAPI/homeAPI";
import { getDateKeyStartMs, getLocalDateKey, getRoutineEventTime } from "@/utils/routineDisplay";
import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

export type AddMealInput = {
	amountBowl?: number;
	amountMl?: number;
	durationMinutes?: number;
	notes?: string;
	time: string;
	type: MealType;
};

type RoutineDataContextValue = {
	addMeal: (input: AddMealInput) => void;
	dailyLogs: RoutineDay[];
	getLatestMeal: () => MealEvent | undefined;
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

		return {
			addMeal,
			dailyLogs,
			getLatestMeal,
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
