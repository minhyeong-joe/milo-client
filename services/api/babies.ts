import { apiGet, apiPost } from "@/services/api/httpClient";

export type BabySex = "GIRL" | "BOY";

export type Baby = {
	id: string;
	name: string;
	birthdate: string;
	sex: BabySex;
	timezone: string;
	avatarObjectKey: string | null;
	createdAt: string;
	updatedAt: string;
};

export type BabyAccess = {
	id: string;
	babyId: string;
	userId: string;
	role: BabyRole;
	createdAt: string;
	updatedAt: string;
};

export type BabyRole = "FATHER" | "MOTHER" | "CAREGIVER";

export type BabyListItem = Baby & {
	role: BabyRole;
};

export type CreateBabyRequest = {
	name: string;
	birthdate: string;
	sex: BabySex;
	timezone?: string;
	avatarObjectKey?: string | null;
	role?: BabyRole;
};

export type CreateBabyResponse = {
	baby: Baby;
	access: BabyAccess;
};

export type GetBabiesResponse = {
	babies: BabyListItem[];
};

export function getBabies() {
	return apiGet<GetBabiesResponse>("/babies", {
		auth: true,
	});
}

export function createBaby(input: CreateBabyRequest) {
	return apiPost<CreateBabyResponse, CreateBabyRequest>("/babies", input, {
		auth: true,
	});
}
