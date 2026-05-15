import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/httpClient";
import type { DiaryTag } from "@/services/api/diary";

export type ListTagsResponse = {
	tags: DiaryTag[];
};

export type CreateTagInput = {
	color?: string;
	name: string;
	type?: string;
};

export type UpdateTagInput = Partial<CreateTagInput>;

export type TagResponse = {
	tag: DiaryTag;
};

export function listTags({
	babyId,
	search,
}: {
	babyId: string;
	search?: string;
}) {
	return apiGet<ListTagsResponse>(`/babies/${babyId}/tags`, {
		auth: true,
		query: { search },
	});
}

export function createTag(babyId: string, input: CreateTagInput) {
	return apiPost<TagResponse, CreateTagInput>(`/babies/${babyId}/tags`, input, {
		auth: true,
	});
}

export function updateTag(babyId: string, tagId: string, input: UpdateTagInput) {
	return apiPatch<TagResponse, UpdateTagInput>(
		`/babies/${babyId}/tags/${tagId}`,
		input,
		{ auth: true },
	);
}

export function deleteTag(babyId: string, tagId: string) {
	return apiDelete<void>(`/babies/${babyId}/tags/${tagId}`, {
		auth: true,
	});
}
