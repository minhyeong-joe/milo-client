import { apiGet } from "@/services/api/httpClient";

export type DailyRoutineConcernLevel = "low" | "watch" | "high";
export type DailyRoutineInsightConfidence = "low" | "medium" | "high";

export type DailyRoutineInsightOutput = {
	signals: {
		meal: string;
		sleep: string;
		diaper: string;
	};
	confidence: DailyRoutineInsightConfidence;
	concern_level: DailyRoutineConcernLevel;
	short_summary: string;
	detailed_summary: string;
};

export type DailyRoutineInsight = {
	analysisDate: string;
	concernLevel: DailyRoutineConcernLevel;
	generatedAt: string;
	id: string;
	isCurrentPrompt: boolean;
	json: DailyRoutineInsightOutput;
	promptId: string | null;
	promptVersion: string | null;
	summary: string;
	text: string | null;
};

export type DailyRoutineInsightResponse = {
	insight: DailyRoutineInsight;
};

export type DailyRoutineInsightStatusesResponse = {
	currentPrompt: {
		id: string | null;
		version: string | null;
	};
	insights: DailyRoutineInsight[];
};

export function listDailyRoutineInsightStatuses({
	babyId,
	endDate,
	startDate,
}: {
	babyId: string;
	endDate: string;
	startDate: string;
}) {
	return apiGet<DailyRoutineInsightStatusesResponse>(
		`/babies/${babyId}/ai/daily/statuses`,
		{
			auth: true,
			query: {
				endDate,
				startDate,
			},
		},
	);
}

export function getDailyRoutineInsight({
	babyId,
	date,
}: {
	babyId: string;
	date: string;
}) {
	return apiGet<DailyRoutineInsightResponse>(`/babies/${babyId}/ai/daily`, {
		auth: true,
		query: { date },
		timeoutMs: 30000,
	});
}

export function getInsightSummary(insight: DailyRoutineInsight | null | undefined) {
	return insight?.json.short_summary ?? "";
}

export function getInsightAnalysis(insight: DailyRoutineInsight | null | undefined) {
	return insight?.json.detailed_summary ?? "";
}
