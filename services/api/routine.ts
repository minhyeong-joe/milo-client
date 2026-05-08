import type { RoutineDay } from "@/data/homeData";
import type {
	DiaperColor,
	DiaperType,
	MealType,
	RoutineKind,
	SleepType,
} from "@/data/homeData";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/httpClient";

export type RoutineLastLogged = {
	meal: {
		time: string;
		type: "breastfeed" | "breastMilk" | "formula" | "solid";
	} | null;
	diaper: {
		time: string;
		type: "wet" | "dirty" | "both" | "dry";
	} | null;
	sleep: {
		id: string;
		endTime: string | null;
		isActive: boolean;
		lastLoggedAt: string;
		startTime: string;
		type: "nap" | "nighttime";
	} | null;
};

export type GetRoutineDaysResponse = {
	dailyLogs: RoutineDay[];
	lastLogged?: RoutineLastLogged;
	nextStartDate: string | null;
};

export type CreateMealLogInput = {
	amountBowl?: number;
	amountGrams?: number;
	amountMl?: number;
	clientMutationId?: string;
	durationMinutes?: number;
	breastSide?: "left" | "right";
	kind: "meal";
	notes?: string;
	time: string;
	type: MealType;
};

export type CreateDiaperLogInput = {
	clientMutationId?: string;
	color?: DiaperColor;
	kind: "diaper";
	notes?: string;
	time: string;
	type: DiaperType;
};

export type CreateSleepLogInput = {
	clientMutationId?: string;
	endTime?: string;
	kind: "sleep";
	notes?: string;
	startTime: string;
	type: SleepType;
};

export type CreateRoutineLogInput =
	| CreateMealLogInput
	| CreateDiaperLogInput
	| CreateSleepLogInput;

export type UpdateRoutineLogInput =
	| Omit<CreateMealLogInput, "kind">
	| Omit<CreateDiaperLogInput, "kind">
	| Omit<CreateSleepLogInput, "kind">;

export type RoutineMutationResponse = {
	affectedDailyLogs: RoutineDay[];
	event?: CreateRoutineLogInput & { id: string };
	deleted?: true;
	lastLogged: RoutineLastLogged;
};

export type RoutineStatsResponse = {
	dayCount: number;
	days: RoutineStatsDay[];
	endDate: string;
	startDate: string;
	summary: RoutineStatsSummary;
};

export type RoutineStatsDay = {
	date: string;
	logs: RoutinePatternLog[];
};

export type RoutinePatternLog =
	| MealPatternLog
	| DiaperPatternLog
	| SleepPatternLog;

export type MealPatternLog = {
	amountBowl?: number | null;
	amountGrams?: number | null;
	amountMl?: number | null;
	durationMinutes?: number | null;
	id: string;
	kind: "meal";
	time: string;
	type: MealType;
};

export type DiaperPatternLog = {
	id: string;
	kind: "diaper";
	time: string;
	type: DiaperType;
};

export type SleepPatternLog = {
	endTime: string | null;
	id: string;
	kind: "sleep";
	startTime: string;
	type: SleepType;
};

export type RoutineStatsSummary = {
	diaper: DiaperAverage;
	meal: MealAverage;
	sleep: SleepAverage;
};

export type MealAverage = {
	activeDays: number;
	avgSessionsPerActiveDay: number;
	byType: {
		breastfeed: {
			activeDays: number;
			avgDurationMinutesPerSession: number;
			avgSessionsPerActiveDay: number;
		};
		breastMilk: {
			activeDays: number;
			avgAmountMlPerSession: number;
			avgSessionsPerActiveDay: number;
		};
		formula: {
			activeDays: number;
			avgAmountMlPerSession: number;
			avgSessionsPerActiveDay: number;
		};
		solid: {
			activeDays: number;
			avgBowlsPerSession: number;
			avgGramsPerSession: number;
			avgSessionsPerActiveDay: number;
		};
	};
};

export type DiaperAverage = {
	activeDays: number;
	avgChangesPerActiveDay: number;
	byType: {
		both: {
			avgChangesPerActiveDay: number;
		};
		dirty: {
			avgChangesPerActiveDay: number;
		};
		dry: {
			avgChangesPerActiveDay: number;
		};
		wet: {
			avgChangesPerActiveDay: number;
		};
	};
};

export type SleepAverage = {
	activeDays: number;
	avgDurationMinutesPerActiveDay: number;
	avgSessionsPerActiveDay: number;
	byType: {
		nap: {
			avgDurationMinutesPerActiveDay: number;
			avgSessionsPerActiveDay: number;
		};
		nighttime: {
			avgDurationMinutesPerActiveDay: number;
			avgSessionsPerActiveDay: number;
		};
	};
};

export function getRoutineDays({
	babyId,
	count,
	includeLastLogged,
	startDate,
}: {
	babyId: string;
	count: number;
	includeLastLogged?: boolean;
	startDate: string;
}) {
	return apiGet<GetRoutineDaysResponse>(`/babies/${babyId}/routine/days`, {
		auth: true,
		query: {
			count,
			includeLastLogged: includeLastLogged ? "true" : undefined,
			startDate,
		},
	});
}

export function getRoutineStats({
	babyId,
	endDate,
	startDate,
}: {
	babyId: string;
	endDate: string;
	startDate: string;
}) {
	return apiGet<RoutineStatsResponse>(`/babies/${babyId}/routine/stats`, {
		auth: true,
		query: {
			endDate,
			startDate,
		},
	});
}

export function createRoutineLog(babyId: string, input: CreateRoutineLogInput) {
	return apiPost<RoutineMutationResponse, CreateRoutineLogInput>(
		`/babies/${babyId}/routine/logs`,
		input,
		{ auth: true },
	);
}

export function updateRoutineLog(
	babyId: string,
	kind: RoutineKind,
	id: string,
	input: UpdateRoutineLogInput,
) {
	return apiPatch<RoutineMutationResponse, UpdateRoutineLogInput>(
		`/babies/${babyId}/routine/logs/${kind}/${id}`,
		input,
		{ auth: true },
	);
}

export function deleteRoutineLog(babyId: string, kind: RoutineKind, id: string) {
	return apiDelete<RoutineMutationResponse>(
		`/babies/${babyId}/routine/logs/${kind}/${id}`,
		{ auth: true },
	);
}
