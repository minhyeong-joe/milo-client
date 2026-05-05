import type { RoutineDay } from "@/data/homeData";
import { apiGet } from "@/services/api/httpClient";

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
