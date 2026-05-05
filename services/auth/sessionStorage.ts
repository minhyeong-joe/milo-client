import type { AuthSession } from "@/services/api/auth";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_STORAGE_KEY = "milo.auth.session";

export async function loadStoredSession() {
	const rawSession = await readSessionValue();

	if (!rawSession) {
		return null;
	}

	try {
		return JSON.parse(rawSession) as AuthSession;
	} catch {
		await clearStoredSession();
		return null;
	}
}

export async function saveStoredSession(session: AuthSession) {
	await writeSessionValue(JSON.stringify(session));
}

export async function clearStoredSession() {
	if (Platform.OS === "web") {
		globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
		return;
	}

	await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

async function readSessionValue() {
	if (Platform.OS === "web") {
		return globalThis.localStorage?.getItem(SESSION_STORAGE_KEY) ?? null;
	}

	return SecureStore.getItemAsync(SESSION_STORAGE_KEY);
}

async function writeSessionValue(value: string) {
	if (Platform.OS === "web") {
		globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, value);
		return;
	}

	await SecureStore.setItemAsync(SESSION_STORAGE_KEY, value);
}
