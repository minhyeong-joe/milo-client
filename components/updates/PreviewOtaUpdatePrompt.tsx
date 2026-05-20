import {
	checkForPreviewUpdate,
	downloadPreviewUpdate,
	restartWithDownloadedUpdate,
} from "@/services/updates/previewOtaUpdates";
import { useEffect } from "react";
import { Alert } from "react-native";

let hasCheckedForPreviewUpdate = false;
let isHandlingPreviewUpdate = false;

export function PreviewOtaUpdatePrompt() {
	useEffect(() => {
		if (hasCheckedForPreviewUpdate) {
			return;
		}

		hasCheckedForPreviewUpdate = true;
		const timeoutId = setTimeout(() => {
			void checkAndPromptForUpdate();
		}, 1200);

		return () => clearTimeout(timeoutId);
	}, []);

	return null;
}

async function checkAndPromptForUpdate() {
	const result = await checkForPreviewUpdate();

	if (!result.available || isHandlingPreviewUpdate) {
		return;
	}

	Alert.alert(
		"Update available",
		"There is an over-the-air update available. Update and restart now?",
		[
			{
				style: "cancel",
				text: "Not now",
			},
			{
				onPress: () => {
					void downloadAndRestart();
				},
				text: "Update",
			},
		],
	);
}

async function downloadAndRestart() {
	if (isHandlingPreviewUpdate) {
		return;
	}

	isHandlingPreviewUpdate = true;

	try {
		const didDownload = await downloadPreviewUpdate();

		if (!didDownload) {
			Alert.alert("Update unavailable", "The update could not be downloaded.");
			return;
		}

		await restartWithDownloadedUpdate();
	} catch (error) {
		Alert.alert(
			"Update failed",
			error instanceof Error
				? error.message
				: "The update could not be downloaded.",
		);
	} finally {
		isHandlingPreviewUpdate = false;
	}
}
