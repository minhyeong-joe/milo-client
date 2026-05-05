import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SELECTED_BABY_STORAGE_KEY_PREFIX = "milo.babySelection.selectedBabyId";

export async function loadStoredSelectedBabyId(userId: string) {
	return readValue(getStorageKey(userId));
}

export async function saveStoredSelectedBabyId(userId: string, babyId: string) {
	await writeValue(getStorageKey(userId), babyId);
}

function getStorageKey(userId: string) {
	return `${SELECTED_BABY_STORAGE_KEY_PREFIX}.${userId}`;
}

async function readValue(key: string) {
	if (Platform.OS === "web") {
		return globalThis.localStorage?.getItem(key) ?? null;
	}

	return SecureStore.getItemAsync(key);
}

async function writeValue(key: string, value: string) {
	if (Platform.OS === "web") {
		globalThis.localStorage?.setItem(key, value);
		return;
	}

	await SecureStore.setItemAsync(key, value);
}
