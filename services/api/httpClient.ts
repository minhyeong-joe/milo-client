const API_PREFIX = "/api";
const DEFAULT_TIMEOUT_MS = 15000;

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type MaybePromise<T> = T | Promise<T>;
type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | null | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;

export type ApiErrorBody = {
	error?: {
		code?: string;
		message?: string;
		details?: unknown;
	};
};

export type ApiClientConfig = {
	baseUrl?: string;
	getAccessToken?: () => MaybePromise<string | null>;
	refreshAccessToken?: () => MaybePromise<string | null>;
	onUnauthorized?: () => void;
};

export type ApiRequestOptions<TBody = unknown> = {
	method?: HttpMethod;
	body?: TBody;
	query?: QueryParams;
	headers?: Record<string, string>;
	auth?: boolean;
	retryOnUnauthorized?: boolean;
	signal?: AbortSignal;
	timeoutMs?: number;
};

type ApiErrorInput = {
	status: number;
	message: string;
	code?: string;
	details?: unknown;
	body?: unknown;
};

export class ApiError extends Error {
	status: number;
	code?: string;
	details?: unknown;
	body?: unknown;

	constructor({ status, message, code, details, body }: ApiErrorInput) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.details = details;
		this.body = body;
	}
}

let apiClientConfig: ApiClientConfig = {};

export function configureApiClient(config: ApiClientConfig) {
	apiClientConfig = {
		...apiClientConfig,
		...config,
	};
}

export function getApiBaseUrl() {
	const baseUrl = apiClientConfig.baseUrl ?? process.env.EXPO_PUBLIC_API_URL;

	if (!baseUrl) {
		throw new ApiError({
			status: 0,
			message: "Missing EXPO_PUBLIC_API_URL. Set it to the Milo API server base URL.",
		});
	}

	return trimTrailingSlashes(baseUrl);
}

export function buildApiUrl(path: string, query?: QueryParams) {
	const queryString = buildQueryString(query);
	return `${getApiBaseUrl()}${normalizeApiPath(path)}${queryString ? `?${queryString}` : ""}`;
}

export async function apiRequest<TResponse, TBody = unknown>(
	path: string,
	options: ApiRequestOptions<TBody> = {},
): Promise<TResponse> {
	const shouldUseAuth = options.auth === true;
	const initialAccessToken = shouldUseAuth ? await getAccessToken() : null;
	let response = await fetchApi(path, options, initialAccessToken);

	if (response.status === 401 && shouldUseAuth && options.retryOnUnauthorized !== false) {
		const refreshedAccessToken = await refreshAccessToken();

		if (refreshedAccessToken) {
			response = await fetchApi(path, options, refreshedAccessToken);
		}
	}

	if (response.status === 401 && shouldUseAuth) {
		apiClientConfig.onUnauthorized?.();
	}

	return parseApiResponse<TResponse>(response);
}

type ApiRequestOptionsWithoutBody = Omit<ApiRequestOptions<never>, "body" | "method">;
type ApiRequestOptionsWithBody<TBody> = Omit<ApiRequestOptions<TBody>, "method">;

export function apiGet<TResponse>(path: string, options?: ApiRequestOptionsWithoutBody) {
	return apiRequest<TResponse>(path, {
		...options,
		method: "GET",
	});
}

export function apiPost<TResponse, TBody = unknown>(
	path: string,
	body: TBody,
	options?: ApiRequestOptionsWithBody<TBody>,
) {
	return apiRequest<TResponse, TBody>(path, {
		...options,
		body,
		method: "POST",
	});
}

export function apiPatch<TResponse, TBody = unknown>(
	path: string,
	body: TBody,
	options?: ApiRequestOptionsWithBody<TBody>,
) {
	return apiRequest<TResponse, TBody>(path, {
		...options,
		body,
		method: "PATCH",
	});
}

export function apiDelete<TResponse>(path: string, options?: ApiRequestOptionsWithoutBody) {
	return apiRequest<TResponse>(path, {
		...options,
		method: "DELETE",
	});
}

async function fetchApi<TBody>(
	path: string,
	options: ApiRequestOptions<TBody>,
	accessToken: string | null,
) {
	const headers: Record<string, string> = {
		Accept: "application/json",
		...options.headers,
	};

	if (options.body !== undefined) {
		headers["Content-Type"] = "application/json";
	}

	if (accessToken) {
		headers.Authorization = `Bearer ${accessToken}`;
	}

	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const timeoutController = new AbortController();
	const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
	const signal = mergeAbortSignals(options.signal, timeoutController.signal);

	try {
		return await fetch(buildApiUrl(path, options.query), {
			body: options.body === undefined ? undefined : JSON.stringify(options.body),
			headers,
			method: options.method ?? "GET",
			signal,
		});
	} catch (error) {
		throw createNetworkError(error, timeoutController.signal.aborted);
	} finally {
		clearTimeout(timeoutId);
	}
}

async function parseApiResponse<TResponse>(response: Response): Promise<TResponse> {
	if (response.status === 204) {
		return undefined as TResponse;
	}

	const body = await readResponseBody(response);

	if (!response.ok) {
		throw createApiError(response, body);
	}

	return body as TResponse;
}

async function readResponseBody(response: Response) {
	const text = await response.text();

	if (!text) {
		return undefined;
	}

	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

function createApiError(response: Response, body: unknown) {
	const apiError = isApiErrorBody(body) ? body.error : undefined;

	return new ApiError({
		status: response.status,
		code: apiError?.code,
		details: apiError?.details,
		body,
		message: apiError?.message ?? `Milo API request failed with status ${response.status}.`,
	});
}

function createNetworkError(error: unknown, didTimeout: boolean) {
	if (didTimeout) {
		return new ApiError({
			status: 0,
			code: "REQUEST_TIMEOUT",
			body: error,
			message: "Milo API request timed out. Please try again.",
		});
	}

	return new ApiError({
		status: 0,
		code: "NETWORK_ERROR",
		body: error,
		message: "Could not reach Milo API. Please check your connection and try again.",
	});
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
	return (
		typeof body === "object" &&
		body !== null &&
		"error" in body &&
		typeof (body as ApiErrorBody).error === "object" &&
		(body as ApiErrorBody).error !== null
	);
}

async function getAccessToken() {
	return apiClientConfig.getAccessToken ? apiClientConfig.getAccessToken() : null;
}

async function refreshAccessToken() {
	return apiClientConfig.refreshAccessToken ? apiClientConfig.refreshAccessToken() : null;
}

function normalizeApiPath(path: string) {
	const pathWithLeadingSlash = path.startsWith("/") ? path : `/${path}`;

	if (pathWithLeadingSlash === API_PREFIX || pathWithLeadingSlash.startsWith(`${API_PREFIX}/`)) {
		return pathWithLeadingSlash;
	}

	return `${API_PREFIX}${pathWithLeadingSlash}`;
}

function trimTrailingSlashes(value: string) {
	return value.replace(/\/+$/, "");
}

function buildQueryString(query?: QueryParams) {
	if (!query) {
		return "";
	}

	const parts: string[] = [];

	Object.entries(query).forEach(([key, value]) => {
		const values = Array.isArray(value) ? value : [value];

		values.forEach((item) => {
			if (item === null || item === undefined) {
				return;
			}

			parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
		});
	});

	return parts.join("&");
}

function mergeAbortSignals(...signals: Array<AbortSignal | undefined>) {
	const activeSignals = signals.filter(Boolean) as AbortSignal[];

	if (activeSignals.length === 1) {
		return activeSignals[0];
	}

	const controller = new AbortController();
	const abort = () => controller.abort();

	activeSignals.forEach((signal) => {
		if (signal.aborted) {
			abort();
			return;
		}

		signal.addEventListener("abort", abort, { once: true });
	});

	return controller.signal;
}
