import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/httpClient";

export type BabySex = "GIRL" | "BOY";

export type Baby = {
	id: string;
	name: string;
	birthdate: string;
	sex: BabySex;
	timezone: string;
	avatarObjectKey: string | null;
	avatarUrl: string | null;
	immunizationScheduleProfile?: "US_CDC" | "KR_KDCA" | "WHO_GENERAL" | "CUSTOM";
	isOwner?: boolean;
	createdAt: string;
	updatedAt: string;
};

export type BabyAccess = {
	id: string;
	babyId: string;
	userId: string;
	role: BabyRole;
	isOwner?: boolean;
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

export type UpdateBabyRequest = {
	name: string;
	birthdate: string;
	sex: BabySex;
	timezone?: string;
};

export type CreateBabyResponse = {
	baby: Baby;
	access: BabyAccess;
};

export type UpdateBabyResponse = {
	baby: Baby;
};

export type CreateBabyAvatarUploadRequest = {
	contentType: "image/jpeg" | "image/png";
	sizeBytes: number;
};

export type CreateBabyAvatarUploadResponse = {
	objectKey: string;
	uploadUrl: string;
	expiresIn: number;
};

export type ConfirmBabyAvatarRequest = {
	objectKey: string;
};

export type GetBabiesResponse = {
	babies: BabyListItem[];
};

export type BabyInviteStatus =
	| "pending"
	| "accepted"
	| "declined"
	| "expired"
	| "revoked";

export type BabyUserSummary = {
	id: string;
	email: string;
	displayName: string | null;
};

export type BabyInviteSummary = {
	id: string;
	name: string;
	birthdate: string;
	sex: BabySex;
	timezone: string;
	avatarObjectKey: string | null;
};

export type BabyInvite = {
	id: string;
	babyId: string;
	email: string;
	inviteCode: string;
	status: BabyInviteStatus;
	expiresAt: string;
	acceptedByUserId: string | null;
	createdAt: string;
	updatedAt: string;
	baby?: BabyInviteSummary;
	owner?: BabyUserSummary | null;
	invitedBy?: BabyUserSummary | null;
};

export type BabyMember = {
	id: string;
	babyId: string;
	userId: string;
	role: BabyRole;
	isOwner: boolean;
	user: BabyUserSummary | null;
	createdAt: string;
	updatedAt: string;
};

export type EmailDelivery =
	| { status: "sent"; id: string | null }
	| { status: "skipped"; reason: string }
	| { status: "failed"; error: string };

export type CreateBabyInviteRequest = {
	email: string;
};

export type CreateBabyInviteResponse = {
	invite: BabyInvite;
	emailDelivery?: EmailDelivery;
};

export type ListBabyMembersResponse = {
	members: BabyMember[];
};

export type ListInvitesResponse = {
	invites: BabyInvite[];
};

export type AcceptBabyInviteRequest = {
	inviteCode: string;
	role: BabyRole;
};

export type AcceptBabyInviteResponse = {
	invite: BabyInvite;
	access: BabyAccess;
};

export type DeclineBabyInviteRequest = {
	inviteCode: string;
};

export type DeclineBabyInviteResponse = {
	invite: BabyInvite;
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

export function updateBaby(babyId: string, input: UpdateBabyRequest) {
	return apiPatch<UpdateBabyResponse, UpdateBabyRequest>(`/babies/${babyId}`, input, {
		auth: true,
	});
}

export function createBabyAvatarUpload(
	babyId: string,
	input: CreateBabyAvatarUploadRequest,
) {
	return apiPost<CreateBabyAvatarUploadResponse, CreateBabyAvatarUploadRequest>(
		`/babies/${babyId}/avatar/presign-upload`,
		input,
		{ auth: true },
	);
}

export function confirmBabyAvatar(babyId: string, input: ConfirmBabyAvatarRequest) {
	return apiPost<UpdateBabyResponse, ConfirmBabyAvatarRequest>(
		`/babies/${babyId}/avatar/confirm`,
		input,
		{ auth: true },
	);
}

export function removeBabyAvatar(babyId: string) {
	return apiDelete<UpdateBabyResponse>(`/babies/${babyId}/avatar`, {
		auth: true,
	});
}

export function listBabyMembers(babyId: string) {
	return apiGet<ListBabyMembersResponse>(`/babies/${babyId}/members`, {
		auth: true,
	});
}

export function createBabyInvite(
	babyId: string,
	input: CreateBabyInviteRequest,
) {
	return apiPost<CreateBabyInviteResponse, CreateBabyInviteRequest>(
		`/babies/${babyId}/invites`,
		input,
		{ auth: true },
	);
}

export function listMyInvites() {
	return apiGet<ListInvitesResponse>("/invites", {
		auth: true,
	});
}

export function acceptBabyInvite(input: AcceptBabyInviteRequest) {
	return apiPost<AcceptBabyInviteResponse, AcceptBabyInviteRequest>(
		"/invites/accept",
		{
			...input,
			inviteCode: normalizeInviteCode(input.inviteCode),
		},
		{ auth: true },
	);
}

export function declineBabyInvite(input: DeclineBabyInviteRequest) {
	return apiPost<DeclineBabyInviteResponse, DeclineBabyInviteRequest>(
		"/invites/decline",
		{
			inviteCode: normalizeInviteCode(input.inviteCode),
		},
		{ auth: true },
	);
}

export function removeBabyMember(babyId: string, userId: string) {
	return apiDelete<void>(`/babies/${babyId}/members/${userId}`, {
		auth: true,
	});
}

export function leaveBaby(babyId: string) {
	return apiDelete<void>(`/babies/${babyId}/members/me`, {
		auth: true,
	});
}

export function normalizeInviteCode(value: string) {
	return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
}
