import { apiGet, apiPost } from "@/services/api/httpClient";
import type { DiaryTag } from "@/services/api/diary";

export type ListTagsResponse = {
	tags: DiaryTag[];
};

export type CreateTagInput = {
	color?: string;
	name: string;
	type?: string;
};

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
