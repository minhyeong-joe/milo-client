import { useAppTheme } from "@/context/AppPreferencesContext";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Platform, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";

type DiaryActionsModalProps = {
	onClose: () => void;
	onDelete: () => void;
	onEdit: () => void;
	visible: boolean;
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function DiaryActionsModal({
	onClose,
	onDelete,
	onEdit,
	visible,
}: DiaryActionsModalProps) {
	const { themeColors, styles } = useThemeStyles();
	const insets = useSafeAreaInsets();
	const androidButtonOffset =
		Platform.OS === "android" ? Math.max(insets.bottom, 48) : 0;

	return (
		<Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
			<Pressable accessibilityRole="button" onPress={onClose} style={styles.backdrop}>
				<Pressable
					style={[
						styles.card,
						androidButtonOffset > 0 && {
							transform: [{ translateY: -androidButtonOffset }],
						},
					]}
				>
					<Pressable
						accessibilityRole="button"
						onPress={onEdit}
						style={styles.actionRow}
					>
						<Ionicons color={themeColors.textPrimary} name="create-outline" size={20} />
						<Text style={styles.actionText}>Edit</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={onDelete}
						style={styles.actionRow}
					>
						<Ionicons color={themeColors.error} name="trash-outline" size={20} />
						<Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	actionRow: {
		alignItems: "center",
		borderRadius: 12,
		flexDirection: "row",
		gap: spacing.sm,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.md,
	},
	actionText: {
		...typography.body,
		color: themeColors.textPrimary,
		fontWeight: "700",
	},
	backdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.45)",
		flex: 1,
		justifyContent: "flex-end",
		padding: spacing.lg,
	},
	card: {
		backgroundColor: themeColors.surface,
		borderRadius: 18,
		gap: spacing.xs,
		padding: spacing.md,
		width: "100%",
	},
	deleteText: {
		color: themeColors.error,
	},
});
}
