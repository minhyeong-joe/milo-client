import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/httpClient";

export type ImmunizationScheduleProfile =
	| "US_CDC"
	| "KR_KDCA"
	| "WHO_GENERAL"
	| "CUSTOM";

export type ImmunizationScheduleItem = {
	id: string;
	scheduleProfile: ImmunizationScheduleProfile;
	vaccineCode: string;
	vaccineName: string;
	doseLabel: string;
	recommendedAgeMonthsMin: number;
	recommendedAgeMonthsMax?: number;
	displayAge: string;
	notes?: string;
	recommendedAgeDaysMin?: number;
	recommendedAgeDaysMax?: number;
};

export type BabyImmunizationRecord = {
	id: string;
	babyId: string;
	scheduleItemId: string | null;
	vaccineName: string;
	doseLabel: string | null;
	givenDate: string;
	providerName: string | null;
	clinicName: string | null;
	lotNumber: string | null;
	notes: string | null;
	isCustom: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ImmunizationRecordInput = {
	scheduleItemId?: string | null;
	vaccineName?: string;
	doseLabel?: string;
	givenDate: string;
	providerName?: string;
	clinicName?: string;
	lotNumber?: string;
	notes?: string;
};

export type GetImmunizationsResponse = {
	scheduleProfile: ImmunizationScheduleProfile;
	scheduleItems: ImmunizationScheduleItem[];
	records: BabyImmunizationRecord[];
};

export type ImmunizationRecordResponse = {
	record: BabyImmunizationRecord;
};

export type UpdateImmunizationProfileResponse = {
	scheduleProfile: ImmunizationScheduleProfile;
	scheduleItems: ImmunizationScheduleItem[];
};

export function getImmunizations(babyId: string) {
	return apiGet<GetImmunizationsResponse>(`/babies/${babyId}/immunizations`, {
		auth: true,
	});
}

export function createImmunizationRecord(babyId: string, input: ImmunizationRecordInput) {
	return apiPost<ImmunizationRecordResponse, ImmunizationRecordInput>(
		`/babies/${babyId}/immunizations/records`,
		input,
		{ auth: true },
	);
}

export function updateImmunizationRecord(
	babyId: string,
	recordId: string,
	input: ImmunizationRecordInput,
) {
	return apiPatch<ImmunizationRecordResponse, ImmunizationRecordInput>(
		`/babies/${babyId}/immunizations/records/${recordId}`,
		input,
		{ auth: true },
	);
}

export function deleteImmunizationRecord(babyId: string, recordId: string) {
	return apiDelete<void>(`/babies/${babyId}/immunizations/records/${recordId}`, {
		auth: true,
	});
}

export function updateImmunizationProfile(
	babyId: string,
	scheduleProfile: ImmunizationScheduleProfile,
) {
	return apiPatch<UpdateImmunizationProfileResponse, { scheduleProfile: ImmunizationScheduleProfile }>(
		`/babies/${babyId}/immunizations/profile`,
		{ scheduleProfile },
		{ auth: true },
	);
}
