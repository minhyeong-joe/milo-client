import * as Updates from "expo-updates";

export type PreviewUpdateCheckResult =
	| {
			available: true;
			reason: "available";
	  }
	| {
			available: false;
			reason: "disabled" | "wrong-channel" | "not-available" | "error";
			message?: string;
	  };

const PREVIEW_CHANNEL = "preview";

export function getPreviewUpdateStatus() {
	const channel = Updates.channel ?? null;
	const isPreviewChannel = channel === PREVIEW_CHANNEL;
	const isAvailableInThisBuild = Updates.isEnabled && isPreviewChannel;

	return {
		channel,
		currentUpdateId: Updates.updateId ?? null,
		isAvailableInThisBuild,
		isEnabled: Updates.isEnabled,
		isPreviewChannel,
	};
}

export async function checkForPreviewUpdate(): Promise<PreviewUpdateCheckResult> {
	const status = getPreviewUpdateStatus();

	if (!status.isEnabled) {
		return {
			available: false,
			reason: "disabled",
			message: "OTA updates are not available in this build.",
		};
	}

	if (!status.isPreviewChannel) {
		return {
			available: false,
			reason: "wrong-channel",
			message: "OTA update checks are only enabled for preview builds.",
		};
	}

	try {
		const result = await Updates.checkForUpdateAsync();

		if (result.isAvailable) {
			return {
				available: true,
				reason: "available",
			};
		}

		return {
			available: false,
			reason: "not-available",
			message: "No update is available.",
		};
	} catch (error) {
		return {
			available: false,
			reason: "error",
			message:
				error instanceof Error
					? error.message
					: "Unable to check for updates right now.",
		};
	}
}

export async function downloadPreviewUpdate() {
	const result = await Updates.fetchUpdateAsync();
	return result.isNew;
}

export async function restartWithDownloadedUpdate() {
	await Updates.reloadAsync();
}
