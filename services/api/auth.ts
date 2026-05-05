import { apiPost } from "@/services/api/httpClient";

export type MiloUser = {
	id: string;
	email: string;
	displayName: string | null;
	authProvider: string;
	authProviderUserId: string;
	createdAt: string;
	updatedAt: string;
};

export type AuthSessionTokens = {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	expiresAt: number;
	tokenType: string;
};

export type AuthSession = AuthSessionTokens & {
	user: MiloUser;
};

export type SignInRequest = {
	email: string;
	password: string;
};

export type SignInResponse = AuthSessionTokens & {
	user: MiloUser;
};

export type SignUpRequest = {
	email: string;
	password: string;
	displayName?: string;
};

export type SignUpResponse = {
	user: MiloUser | null;
	session: AuthSessionTokens | null;
	emailConfirmationRequired: boolean;
};

export function signInUser(input: SignInRequest) {
	return apiPost<SignInResponse, SignInRequest>("/auth/signin", input);
}

export function signUpUser(input: SignUpRequest) {
	return apiPost<SignUpResponse, SignUpRequest>("/auth/signup", input);
}
