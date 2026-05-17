import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import { useState, useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function RoutineAIInsight() {
	const { themeColors, styles } = useThemeStyles();
	const [isModalVisible, setIsModalVisible] = useState(false);

	return (
		<>
			<Pressable
				accessibilityRole="button"
				onPress={() => setIsModalVisible(true)}
				style={styles.card}
			>
				<View style={styles.header}>
					<Ionicons color={themeColors.primary} name="sparkles" size={22} />
					<Text style={styles.title}>AI Daily Insight</Text>
				</View>
				<Text style={styles.body}>
					When the day is complete, Milo can summarize this routine and share a gentle reflection.
				</Text>
			</Pressable>
			<Modal
				animationType="fade"
				onRequestClose={() => setIsModalVisible(false)}
				transparent
				visible={isModalVisible}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => setIsModalVisible(false)}
					style={styles.backdrop}
				>
					<Pressable style={styles.modalCard}>
						<View style={styles.modalIcon}>
							<Ionicons color={themeColors.primary} name="sparkles" size={24} />
						</View>
						<Text style={styles.modalTitle}>AI Daily Insight</Text>
						<Text style={styles.modalText}>
							After nighttime sleep ends and the previous day is complete, Milo will be able to turn structured routine stats into a calm summary with reassurance and gentle suggestions.
						</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => setIsModalVisible(false)}
							style={styles.closeButton}
						>
							<Text style={styles.closeButtonText}>Close</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	backdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.35)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	body: {
		...typography.body,
		color: themeColors.textPrimary,
		lineHeight: 22,
	},
	card: {
		backgroundColor: themeColors.secondary,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		gap: spacing.sm,
		marginTop: spacing.md,
		padding: spacing.md,
	},
	closeButton: {
		alignItems: "center",
		alignSelf: "stretch",
		backgroundColor: themeColors.primary,
		borderRadius: 12,
		marginTop: spacing.sm,
		paddingVertical: spacing.md,
	},
	closeButtonText: {
		...typography.label,
		color: themeColors.surface,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.sm,
	},
	modalCard: {
		alignItems: "center",
		backgroundColor: themeColors.surface,
		borderRadius: 18,
		gap: spacing.md,
		padding: spacing.lg,
		width: "100%",
	},
	modalIcon: {
		alignItems: "center",
		backgroundColor: "#F0E5FF",
		borderRadius: 999,
		height: 52,
		justifyContent: "center",
		width: 52,
	},
	modalText: {
		...typography.body,
		color: themeColors.textSecondary,
		lineHeight: 22,
		textAlign: "center",
	},
	modalTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
	},
	title: {
		...typography.label,
		color: themeColors.primary,
		fontWeight: "800",
	},
});
}
