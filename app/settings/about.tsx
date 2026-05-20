import { SettingsHeader } from "@/components/settings/SettingsRows";
import { useAppTheme } from "@/context/AppPreferencesContext";
import {
	checkForPreviewUpdate,
	downloadPreviewUpdate,
	getPreviewUpdateStatus,
	restartWithDownloadedUpdate,
} from "@/services/updates/previewOtaUpdates";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type UpdateState = "idle" | "checking" | "available" | "none" | "downloading";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function AboutScreen() {
	const router = useRouter();
	const { globalStyles, styles, themeColors } = useThemeStyles();
	const updateStatus = getPreviewUpdateStatus();
	const [updateState, setUpdateState] = useState<UpdateState>("idle");
	const [statusMessage, setStatusMessage] = useState(getInitialStatusMessage(updateStatus));
	const appVersion = Constants.expoConfig?.version ?? "1.0.0";

	const isBusy = updateState === "checking" || updateState === "downloading";
	const buttonLabel = getButtonLabel(updateState);

	const handleUpdatePress = async () => {
		if (updateState === "available") {
			await downloadAndRestart();
			return;
		}

		await checkForUpdate();
	};

	const checkForUpdate = async () => {
		setUpdateState("checking");
		setStatusMessage("Checking for preview update...");

		const result = await checkForPreviewUpdate();

		if (result.available) {
			setUpdateState("available");
			setStatusMessage("An over-the-air update is available.");
			return;
		}

		setUpdateState("none");
		setStatusMessage(result.message ?? "No update is available.");
	};

	const downloadAndRestart = async () => {
		setUpdateState("downloading");
		setStatusMessage("Downloading update...");

		try {
			const didDownload = await downloadPreviewUpdate();

			if (!didDownload) {
				setUpdateState("none");
				setStatusMessage("The update could not be downloaded.");
				Alert.alert("Update unavailable", "The update could not be downloaded.");
				return;
			}

			setStatusMessage("Update downloaded. Restarting...");
			await restartWithDownloadedUpdate();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "The update could not be downloaded.";
			setUpdateState("available");
			setStatusMessage(message);
			Alert.alert("Update failed", message);
		}
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="About" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Milo</Text>
					<InfoRow label="App version" value={appVersion} />
					<InfoRow
						label="Update channel"
						value={updateStatus.channel ?? "Not available"}
					/>
					<InfoRow
						label="Current OTA update"
						value={updateStatus.currentUpdateId ?? "Bundled app"}
					/>
				</View>

				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Over-the-air Updates</Text>
					<Text style={styles.statusText}>{statusMessage}</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ disabled: isBusy }}
						disabled={isBusy}
						onPress={() => void handleUpdatePress()}
						style={({ pressed }) => [
							styles.updateButton,
							pressed && !isBusy && styles.pressed,
							isBusy && styles.disabledButton,
						]}
					>
						<Text style={styles.updateButtonText}>{buttonLabel}</Text>
					</Pressable>
					{!updateStatus.isAvailableInThisBuild ? (
						<Text style={[styles.helperText, { color: themeColors.textSecondary }]}>
							Update checks are enabled only in EAS preview builds.
						</Text>
					) : null}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	const { styles } = useThemeStyles();

	return (
		<View style={styles.infoRow}>
			<Text style={styles.infoLabel}>{label}</Text>
			<Text style={styles.infoValue}>{value}</Text>
		</View>
	);
}

function getButtonLabel(updateState: UpdateState) {
	if (updateState === "checking") {
		return "Checking...";
	}

	if (updateState === "available") {
		return "Download Update";
	}

	if (updateState === "downloading") {
		return "Downloading...";
	}

	return "Check for Update";
}

function getInitialStatusMessage(status: ReturnType<typeof getPreviewUpdateStatus>) {
	if (!status.isEnabled) {
		return "OTA updates are not available in this build.";
	}

	if (!status.isPreviewChannel) {
		return "OTA update checks are only enabled for preview builds.";
	}

	return "Check for a preview over-the-air update.";
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		disabledButton: {
			opacity: 0.6,
		},
		helperText: {
			...typography.caption,
			marginTop: spacing.sm,
		},
		infoLabel: {
			...typography.caption,
			color: themeColors.textSecondary,
			textTransform: "uppercase",
		},
		infoRow: {
			gap: spacing.xs,
			marginTop: spacing.md,
		},
		infoValue: {
			...typography.body,
			color: themeColors.textPrimary,
		},
		pressed: {
			opacity: 0.72,
		},
		sectionTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
		statusText: {
			...typography.body,
			color: themeColors.textSecondary,
			marginTop: spacing.md,
		},
		updateButton: {
			alignItems: "center",
			backgroundColor: themeColors.primary,
			borderRadius: 14,
			justifyContent: "center",
			marginTop: spacing.md,
			minHeight: 52,
			paddingHorizontal: spacing.md,
		},
		updateButtonText: {
			...typography.label,
			color: themeColors.primaryContrast,
		},
	});
}
