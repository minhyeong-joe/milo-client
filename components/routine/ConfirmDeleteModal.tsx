import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmDeleteModalProps = {
	confirmLabel: string;
	message: string;
	onCancel: () => void;
	onConfirm: () => void;
	title: string;
	visible: boolean;
};

export function ConfirmDeleteModal({
	confirmLabel,
	message,
	onCancel,
	onConfirm,
	title,
	visible,
}: ConfirmDeleteModalProps) {
	return (
		<Modal animationType="fade" transparent visible={visible}>
			<View style={styles.backdrop}>
				<View style={styles.modalCard}>
					<Text style={globalStyles.sectionTitleText}>{title}</Text>
					<Text style={styles.message}>{message}</Text>
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

const styles = StyleSheet.create({
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
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderWidth: 1,
	},
	cancelText: {
		color: colors.light.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
	deleteButton: {
		backgroundColor: colors.light.error,
	},
	deleteText: {
		color: colors.light.surface,
		fontSize: 15,
		fontWeight: "800",
	},
	message: {
		...globalStyles.bodyText,
	},
	modalCard: {
		backgroundColor: colors.light.surface,
		borderRadius: 18,
		gap: spacing.md,
		padding: spacing.lg,
		width: "100%",
	},
});
