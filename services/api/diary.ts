import { apiDelete, apiGet, apiPatch, apiPost, apiRequest } from "@/services/api/httpClient";

export type DiaryTag = {
	babyId: string | null;
	color: string;
	createdAt: string;
	id: string;
	name: string;
	scope: "custom" | "global";
	type: string;
	updatedAt: string;
};

export type DiaryMedia = {
	description: string | null;
	diaryId: string;
	fileType: string;
	id: string;
	mediaUrl: string | null;
	mediaUrlExpiresAt: string | null;
	objectKey: string;
	sizeBytes: number;
	sortOrder: number;
	thumbnailFileType: string | null;
	thumbnailObjectKey: string | null;
	thumbnailSizeBytes: number | null;
	thumbnailUrl: string | null;
	thumbnailUrlExpiresAt: string | null;
};

export type DiaryEntryUser = {
	displayName: string | null;
	email: string;
	id: string;
};

export type DiaryEntry = {
	babyId: string;
	content: string;
	createdAt: string;
	createdBy?: DiaryEntryUser | null;
	createdById: string;
	diaryDate: string;
	id: string;
	media: DiaryMedia[];
	tags: DiaryTag[];
	title: string | null;
	updatedAt: string;
	updatedBy?: DiaryEntryUser | null;
	updatedById: string;
};

export type ListDiaryEntriesResponse = {
	diaryEntries: DiaryEntry[];
	nextCursor: string | null;
};

export type DiaryListFilters = {
	endDate?: string | null;
	includeMedia?: boolean | null;
	search?: string | null;
	startDate?: string | null;
	tagIds?: string[];
	tagTypes?: string[];
};

export type DiaryMediaInput = {
	description?: string | null;
	fileType: string;
	objectKey: string;
	sizeBytes: number;
	sortOrder?: number;
	thumbnailFileType?: string | null;
	thumbnailObjectKey?: string | null;
	thumbnailSizeBytes?: number | null;
};

export type CreateDiaryEntryInput = {
	content: string;
	diaryDate: string;
	media?: DiaryMediaInput[];
	tagIds?: string[];
	title?: string | null;
};

export type UpdateDiaryEntryInput = Partial<CreateDiaryEntryInput>;

export type DiaryEntryResponse = {
	diaryEntry: DiaryEntry;
};

export type CreateDiaryMediaUploadRequest = {
	fileType: string;
	sizeBytes: number;
	uploadPurpose?: "media" | "thumbnail";
};

export type CreateDiaryMediaUploadResponse = {
	expiresIn: number;
	objectKey: string;
	uploadUrl: string;
};

export type RemoveDiaryMediaUploadRequest = {
	objectKey: string;
};

export function listDiaryEntries({
	babyId,
	cursor,
	endDate,
	includeMedia,
	search,
	startDate,
	tagIds = [],
	tagTypes = [],
	take = 10,
}: {
	babyId: string;
	cursor?: string | null;
	endDate?: string | null;
	includeMedia?: boolean | null;
	search?: string | null;
	startDate?: string | null;
	tagIds?: string[];
	tagTypes?: string[];
	take?: number;
}) {
	const trimmedSearch = search?.trim();

	return apiGet<ListDiaryEntriesResponse>(`/babies/${babyId}/diaries`, {
		auth: true,
		query: {
			cursor: cursor ?? undefined,
			endDate: cursor ? undefined : endDate,
			includeMedia:
				includeMedia === undefined || includeMedia === null
					? undefined
					: String(includeMedia),
			search: trimmedSearch || undefined,
			startDate: cursor ? undefined : startDate ?? undefined,
			tagIds: tagIds.length > 0 ? tagIds.join(",") : undefined,
			tagTypes: tagTypes.length > 0 ? tagTypes.join(",") : undefined,
			take,
		},
	});
}

export function createDiaryEntry(babyId: string, input: CreateDiaryEntryInput) {
	return apiPost<DiaryEntryResponse, CreateDiaryEntryInput>(
		`/babies/${babyId}/diaries`,
		input,
		{ auth: true },
	);
}

export function createDiaryMediaUpload(
	babyId: string,
	input: CreateDiaryMediaUploadRequest,
) {
	return apiPost<CreateDiaryMediaUploadResponse, CreateDiaryMediaUploadRequest>(
		`/babies/${babyId}/diaries/media/presign-upload`,
		input,
		{ auth: true },
	);
}

export function removeDiaryMediaUpload(
	babyId: string,
	input: RemoveDiaryMediaUploadRequest,
) {
	return apiRequest<void, RemoveDiaryMediaUploadRequest>(`/babies/${babyId}/diaries/media`, {
		auth: true,
		body: input,
		method: "DELETE",
	});
}

export function updateDiaryEntry(
	babyId: string,
	diaryId: string,
	input: UpdateDiaryEntryInput,
) {
	return apiPatch<DiaryEntryResponse, UpdateDiaryEntryInput>(
		`/babies/${babyId}/diaries/${diaryId}`,
		input,
		{ auth: true },
	);
}

export function deleteDiaryEntry(babyId: string, diaryId: string) {
	return apiDelete<void>(`/babies/${babyId}/diaries/${diaryId}`, {
		auth: true,
	});
}
