import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import {
	getTimeZoneDisplayLabel,
	getTimeZoneOptions,
	normalizeTimeZone,
} from "@/utils/timeZones";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function TimeZoneSelector({
	disabled = false,
	label,
	onChange,
	timeZone,
}: {
	disabled?: boolean;
	label: string;
	onChange: (timeZone: string) => void;
	timeZone: string;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const [isOpen, setIsOpen] = useState(false);
	const normalizedTimeZone = normalizeTimeZone(timeZone);
	const options = useMemo(
		() => getTimeZoneOptions(normalizedTimeZone),
		[normalizedTimeZone],
	);

	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<Pressable
				accessibilityRole="button"
				disabled={disabled}
				onPress={() => setIsOpen(true)}
				style={({ pressed }) => [
					styles.selectorButton,
					disabled && styles.selectorButtonDisabled,
					pressed && !disabled && styles.pressedButton,
				]}
			>
				<Text style={styles.selectorValue}>
					{getTimeZoneDisplayLabel(normalizedTimeZone)}
				</Text>
				<Ionicons
					color={themeColors.textSecondary}
					name="chevron-down"
					size={20}
				/>
			</Pressable>
			<Modal
				animationType="fade"
				onRequestClose={() => setIsOpen(false)}
				transparent
				visible={isOpen}
			>
				<View style={styles.modalBackdrop}>
					<View style={[globalStyles.shadowCard, styles.modalCard]}>
						<View style={globalStyles.rowBetween}>
							<Text style={globalStyles.sectionTitleText}>{label}</Text>
							<Pressable
								accessibilityRole="button"
								onPress={() => setIsOpen(false)}
							>
								<Ionicons
									color={themeColors.textSecondary}
									name="close"
									size={22}
								/>
							</Pressable>
						</View>
						<FlatList
							data={options}
							keyExtractor={(item) => item.timeZone}
							renderItem={({ item }) => {
								const isSelected = item.timeZone === normalizedTimeZone;

								return (
									<Pressable
										accessibilityRole="button"
										onPress={() => {
											onChange(item.timeZone);
											setIsOpen(false);
										}}
										style={[
											styles.optionRow,
											isSelected && styles.optionRowSelected,
										]}
									>
										<View style={styles.optionText}>
											<Text style={styles.optionLabel}>{item.label}</Text>
											<Text style={styles.optionSubtext}>{item.offsetLabel}</Text>
										</View>
										{isSelected ? (
											<Ionicons
												color={themeColors.primary}
												name="checkmark"
												size={22}
											/>
										) : null}
									</Pressable>
								);
							}}
						/>
					</View>
				</View>
			</Modal>
		</View>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	field: {
		gap: spacing.xs,
		marginTop: spacing.md
	},
	fieldLabel: {
		...typography.caption,
		color: themeColors.textSecondary,
		textTransform: "uppercase",
	},
	modalBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.32)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	modalCard: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 8,
		borderWidth: 1,
		maxHeight: "78%",
		padding: spacing.md,
		width: "100%",
	},
	optionLabel: {
		...typography.label,
		color: themeColors.textPrimary,
	},
	optionRow: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	optionRowSelected: {
		backgroundColor: "#F1EEFF",
	},
	optionSubtext: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: 2,
	},
	optionText: {
		flex: 1,
	},
	pressedButton: {
		opacity: 0.75,
	},
	selectorButton: {
		alignItems: "center",
		backgroundColor: themeColors.background,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
		minHeight: 50,
		paddingHorizontal: spacing.md,
	},
	selectorButtonDisabled: {
		opacity: 0.5,
	},
	selectorValue: {
		...typography.body,
		color: themeColors.textPrimary,
		flex: 1,
	},
});
}
