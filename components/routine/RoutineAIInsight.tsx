import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/styles/globalStyles";

export function RoutineAIInsight() {
	const [isModalVisible, setIsModalVisible] = useState(false);

	return (
		<>
			<Pressable
				accessibilityRole="button"
				onPress={() => setIsModalVisible(true)}
				style={styles.card}
			>
				<View style={styles.header}>
					<Ionicons color={colors.light.primary} name="sparkles" size={22} />
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
							<Ionicons color={colors.light.primary} name="sparkles" size={24} />
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

const styles = StyleSheet.create({
	backdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.35)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	body: {
		...typography.body,
		color: colors.light.textPrimary,
		lineHeight: 22,
	},
	card: {
		backgroundColor: "#F8F3FF",
		borderColor: "#ECE0FF",
		borderRadius: 14,
		borderWidth: 1,
		gap: spacing.sm,
		marginTop: spacing.md,
		padding: spacing.md,
	},
	closeButton: {
		alignItems: "center",
		alignSelf: "stretch",
		backgroundColor: colors.light.primary,
		borderRadius: 12,
		marginTop: spacing.sm,
		paddingVertical: spacing.md,
	},
	closeButtonText: {
		...typography.label,
		color: colors.light.surface,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.sm,
	},
	modalCard: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
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
		color: colors.light.textSecondary,
		lineHeight: 22,
		textAlign: "center",
	},
	modalTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	title: {
		...typography.label,
		color: colors.light.primary,
		fontWeight: "800",
	},
});
