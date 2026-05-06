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
