import { useMemo } from "react";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmDeleteModalProps = {
	confirmLabel: string;
	message: string;
	onCancel: () => void;
	onConfirm: () => void;
	title: string;
	visible: boolean;
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function ConfirmDeleteModal({
	confirmLabel,
	message,
	onCancel,
	onConfirm,
	title,
	visible,
}: ConfirmDeleteModalProps) {
	const { globalStyles, styles } = useThemeStyles();

	return (
		<Modal animationType="fade" transparent visible={visible}>
			<View style={styles.backdrop}>
				<View style={styles.modalCard}>
					<Text style={globalStyles.sectionTitleText}>{title}</Text>
					<Text style={globalStyles.bodyText}>{message}</Text>
					<View style={styles.actions}>
						<Pressable
							accessibilityRole="button"
							onPress={onCancel}
							style={[styles.button, styles.cancelButton]}
						>
							<Text style={styles.cancelText}>Cancel</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={onConfirm}
							style={[styles.button, styles.deleteButton]}
						>
							<Text style={styles.deleteText}>{confirmLabel}</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	actions: {
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "flex-end",
	},
	backdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.45)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	button: {
		alignItems: "center",
		borderRadius: 14,
		flex: 1,
		paddingVertical: 14,
	},
	cancelButton: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderWidth: 1,
	},
	cancelText: {
		color: themeColors.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
	deleteButton: {
		backgroundColor: themeColors.error,
	},
	deleteText: {
		color: themeColors.surface,
		fontSize: 15,
		fontWeight: "800",
	},
	modalCard: {
		backgroundColor: themeColors.surface,
		borderRadius: 18,
		gap: spacing.md,
		padding: spacing.lg,
		width: "100%",
	},
});
}
