import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/httpClient";

export type GrowthRecord = {
	id: string;
	babyId: string;
	measuredDate: string;
	measuredAt: string;
	heightMm: number | null;
	weightGrams: number | null;
	headCircumferenceMm: number | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
};

export type GrowthRecordInput = {
	measuredDate: string;
	heightMm?: number;
	weightGrams?: number;
	headCircumferenceMm?: number;
	notes?: string;
};

export type GetGrowthRecordsResponse = {
	growthRecords: GrowthRecord[];
};

export type GrowthRecordResponse = {
	growthRecord: GrowthRecord;
};

export function getGrowthRecords(babyId: string) {
	return apiGet<GetGrowthRecordsResponse>(`/babies/${babyId}/growth`, {
		auth: true,
	});
}

export function createGrowthRecord(babyId: string, input: GrowthRecordInput) {
	return apiPost<GrowthRecordResponse, GrowthRecordInput>(
		`/babies/${babyId}/growth`,
		input,
		{ auth: true },
	);
}

export function updateGrowthRecord(
	babyId: string,
	growthId: string,
	input: GrowthRecordInput,
) {
	return apiPatch<GrowthRecordResponse, GrowthRecordInput>(
		`/babies/${babyId}/growth/${growthId}`,
		input,
		{ auth: true },
	);
}

export function deleteGrowthRecord(babyId: string, growthId: string) {
	return apiDelete<void>(`/babies/${babyId}/growth/${growthId}`, {
		auth: true,
	});
}
