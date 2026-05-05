import type { AuthSession, AuthSessionTokens, SignUpRequest } from "@/services/api/auth";
import { signInUser, signUpUser } from "@/services/api/auth";
import type { BabyRole, BabySex, CreateBabyRequest } from "@/services/api/babies";
import { createBaby } from "@/services/api/babies";
import { configureApiClient } from "@/services/api/httpClient";
import {
	clearStoredSession,
	loadStoredSession,
	saveStoredSession,
} from "@/services/auth/sessionStorage";
import {
	createContext,
	type PropsWithChildren,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type SignupDraft = Omit<SignUpRequest, "displayName"> & {
	displayName: string;
	confirmPassword: string;
};

export type CompleteSignupWithBabyInput = {
	name: string;
	birthdate: string;
	sex: BabySex;
	role: BabyRole;
};

type AuthSessionContextValue = {
	error: string | null;
	isLoading: boolean;
	isReady: boolean;
	session: AuthSession | null;
	signIn: (email: string, password: string) => Promise<boolean>;
	startSignupDraft: (input: SignupDraft) => boolean;
	completeSignupWithBaby: (input: CompleteSignupWithBabyInput) => Promise<boolean>;
	clearError: () => void;
	signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
	const [session, setSession] = useState<AuthSession | null>(null);
	const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
	const [pendingSignupSession, setPendingSignupSession] = useState<AuthSession | null>(null);
	const [isReady, setIsReady] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sessionRef = useRef<AuthSession | null>(null);
	const pendingSignupSessionRef = useRef<AuthSession | null>(null);

	useEffect(() => {
		sessionRef.current = session;
	}, [session]);

	useEffect(() => {
		pendingSignupSessionRef.current = pendingSignupSession;
	}, [pendingSignupSession]);

	useEffect(() => {
		configureApiClient({
			getAccessToken: () =>
				sessionRef.current?.accessToken ??
				pendingSignupSessionRef.current?.accessToken ??
				null,
			onUnauthorized: () => {
				void clearStoredSession();
				sessionRef.current = null;
				pendingSignupSessionRef.current = null;
				setSession(null);
				setPendingSignupSession(null);
			},
		});
	}, []);

	useEffect(() => {
		let isMounted = true;

		async function loadSession() {
			try {
				const storedSession = await loadStoredSession();

				if (isMounted) {
					sessionRef.current = storedSession;
					setSession(storedSession);
				}
			} finally {
				if (isMounted) {
					setIsReady(true);
				}
			}
		}

		void loadSession();

		return () => {
			isMounted = false;
		};
	}, []);

	const value = useMemo<AuthSessionContextValue>(
		() => ({
			error,
			isLoading,
			isReady,
			session,
			clearError: () => setError(null),
			signIn: async (email, password) => {
				setError(null);
				setIsLoading(true);

				try {
					const response = await signInUser({
						email: email.trim(),
						password,
					});
					const nextSession = normalizeSession(response, response.user);

					await saveStoredSession(nextSession);
					sessionRef.current = nextSession;
					pendingSignupSessionRef.current = null;
					setSession(nextSession);
					setPendingSignupSession(null);
					setSignupDraft(null);

					return true;
				} catch (caughtError) {
					setError(getErrorMessage(caughtError));
					return false;
				} finally {
					setIsLoading(false);
				}
			},
			startSignupDraft: (input) => {
				setError(null);

				if (input.password !== input.confirmPassword) {
					setError("Passwords do not match.");
					return false;
				}

				setSignupDraft({
					displayName: input.displayName.trim(),
					email: input.email.trim(),
					password: input.password,
					confirmPassword: input.confirmPassword,
				});
				pendingSignupSessionRef.current = null;
				setPendingSignupSession(null);

				return true;
			},
			completeSignupWithBaby: async (input) => {
				setError(null);
				setIsLoading(true);

				try {
					let nextSession = pendingSignupSessionRef.current;

					if (!nextSession) {
						if (!signupDraft) {
							setError("Account details are missing. Go back and create the account again.");
							return false;
						}

						const signupResponse = await signUpUser({
							displayName: signupDraft.displayName,
							email: signupDraft.email,
							password: signupDraft.password,
						});

						if (
							signupResponse.emailConfirmationRequired ||
							!signupResponse.session ||
							!signupResponse.user
						) {
							setError("Check your email to confirm your account before adding a baby.");
							return false;
						}

						nextSession = normalizeSession(signupResponse.session, signupResponse.user);
						pendingSignupSessionRef.current = nextSession;
						setPendingSignupSession(nextSession);
					}

					await createBaby(buildCreateBabyRequest(input));
					await saveStoredSession(nextSession);
					sessionRef.current = nextSession;
					pendingSignupSessionRef.current = null;
					setSession(nextSession);
					setPendingSignupSession(null);
					setSignupDraft(null);

					return true;
				} catch (caughtError) {
					setError(getErrorMessage(caughtError));
					return false;
				} finally {
					setIsLoading(false);
				}
			},
			signOut: async () => {
				await clearStoredSession();
				sessionRef.current = null;
				pendingSignupSessionRef.current = null;
				setSession(null);
				setPendingSignupSession(null);
				setSignupDraft(null);
			},
		}),
		[error, isLoading, isReady, pendingSignupSession, session, signupDraft],
	);

	return (
		<AuthSessionContext.Provider value={value}>
			{children}
		</AuthSessionContext.Provider>
	);
}

export function useAuthSession() {
	const context = useContext(AuthSessionContext);

	if (!context) {
		throw new Error("useAuthSession must be used inside AuthSessionProvider.");
	}

	return context;
}

function normalizeSession(tokens: AuthSessionTokens, user: AuthSession["user"]): AuthSession {
	return {
		...tokens,
		user,
	};
}

function buildCreateBabyRequest(input: CompleteSignupWithBabyInput): CreateBabyRequest {
	return {
		avatarObjectKey: null,
		birthdate: formatDateKey(input.birthdate),
		name: input.name.trim(),
		role: input.role,
		sex: input.sex,
		timezone: getDeviceTimeZone(),
	};
}

function formatDateKey(dateKey: string) {
	return dateKey;
}

function getDeviceTimeZone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong. Please try again.";
}
