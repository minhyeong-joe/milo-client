import { useMemo } from "react";
import type { BabyListItem } from "@/services/api/babies";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { formatBabyAge } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import {
	FlatList,
	Image,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

const fallbackBabyAvatar = require("@/assets/images/baby.png");

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function BabySelectorModal({
	babies,
	onClose,
	onSelectBaby,
	selectedBaby,
	visible,
}: {
	babies: BabyListItem[];
	onClose: () => void;
	onSelectBaby: (babyId: string) => void;
	selectedBaby: BabyListItem | null;
	visible: boolean;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const currentDate = new Date();

	const handleSelectBaby = (babyId: string) => {
		onSelectBaby(babyId);
		onClose();
	};

	return (
		<Modal
			animationType="fade"
			onRequestClose={onClose}
			transparent
			visible={visible}
		>
			<Pressable
				accessibilityRole="button"
				onPress={onClose}
				style={styles.modalBackdrop}
			>
				<Pressable style={[globalStyles.shadowCard, styles.selectorPanel]}>
					<Text style={styles.selectorTitle}>Select baby</Text>
					<FlatList
						data={babies}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => {
							const isSelected = item.id === selectedBaby?.id;

							return (
								<Pressable
									accessibilityRole="button"
									onPress={() => handleSelectBaby(item.id)}
									style={[
										styles.selectorItem,
										isSelected && styles.selectorItemSelected,
									]}
								>
									<View style={[globalStyles.rowCenter, styles.profileRow]}>
										<BabySelectorAvatar baby={item} />
										<View>
											<Text style={styles.selectorName}>{item.name}</Text>
											<Text style={styles.selectorAge}>
												{formatBabyAge(item.birthdate, currentDate)}
											</Text>
										</View>
									</View>
									{isSelected && (
										<Ionicons
											color={themeColors.primary}
											name="checkmark"
											size={22}
										/>
									)}
								</Pressable>
							);
						}}
					/>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

export function BabySelectorAvatar({ baby }: { baby: BabyListItem }) {
	const { styles } = useThemeStyles();
	return (
		<Image
			source={baby.avatarUrl ? { uri: baby.avatarUrl } : fallbackBabyAvatar}
			style={styles.avatar}
		/>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	avatar: {
		alignItems: "center",
		backgroundColor: "#D9BFAE",
		borderRadius: 28,
		height: 56,
		justifyContent: "center",
		overflow: "hidden",
		width: 56,
	},
	modalBackdrop: {
		backgroundColor: "rgba(21, 24, 39, 0.22)",
		flex: 1,
		justifyContent: "flex-start",
		paddingHorizontal: spacing.md,
		paddingTop: 92,
	},
	profileRow: {
		gap: spacing.md,
	},
	selectorAge: {
		color: themeColors.textSecondary,
		fontSize: 13,
		fontWeight: "600",
		marginTop: 2,
	},
	selectorItem: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	selectorItemSelected: {
		backgroundColor: themeColors.secondary,
	},
	selectorName: {
		color: themeColors.textPrimary,
		fontSize: 16,
		fontWeight: "800",
	},
	selectorPanel: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 8,
		borderWidth: 1,
		maxHeight: 320,
		padding: spacing.sm,
	},
	selectorTitle: {
		color: themeColors.textSecondary,
		fontSize: 12,
		fontWeight: "800",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		textTransform: "uppercase",
	},
});
}
