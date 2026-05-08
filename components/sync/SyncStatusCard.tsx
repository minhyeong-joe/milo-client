import {
	AUTH_REQUIRED_SYNC_MESSAGE,
	OFFLINE_SYNC_MESSAGE,
	type SyncStatus,
} from "@/context/SyncContext";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type SyncStatusCardProps = {
	message?: string | null;
	onRetry?: () => void;
	status: Extract<SyncStatus, "syncing" | "offline" | "authRequired">;
};

export function SyncStatusCard({
	message,
	onRetry,
	status,
}: SyncStatusCardProps) {
	const isSyncing = status === "syncing";
	const text = message ?? getDefaultMessage(status);

	return (
		<View style={[globalStyles.card, styles.card]}>
			{isSyncing && <ActivityIndicator color={colors.light.primary} size="small" />}
			<Text style={styles.text}>{text}</Text>
			{!isSyncing && onRetry ? (
				<Pressable
					accessibilityRole="button"
					onPress={onRetry}
					style={styles.retryButton}
				>
					<Text style={styles.retryText}>Try again</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function getDefaultMessage(status: SyncStatusCardProps["status"]) {
	if (status === "syncing") {
		return "Sync in progress...";
	}

	if (status === "authRequired") {
		return AUTH_REQUIRED_SYNC_MESSAGE;
	}

	return OFFLINE_SYNC_MESSAGE;
}

const styles = StyleSheet.create({
	card: {
		alignItems: "center",
		borderColor: colors.light.border,
		flexDirection: "row",
		gap: spacing.sm,
		marginBottom: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	retryButton: {
		backgroundColor: colors.light.primary,
		borderRadius: 8,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	retryText: {
		color: colors.light.surface,
		fontSize: 12,
		fontWeight: "800",
	},
	text: {
		color: colors.light.textSecondary,
		flex: 1,
		fontSize: 13,
		fontWeight: "700",
	},
});
