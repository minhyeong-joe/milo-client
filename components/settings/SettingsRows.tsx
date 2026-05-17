import { useMemo } from "react";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function SettingsHeader({
	onBack,
	title,
}: {
	onBack?: () => void;
	title: string;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.header}>
			{onBack ? (
				<Pressable accessibilityRole="button" onPress={onBack} style={styles.headerButton}>
					<Ionicons color={themeColors.textPrimary} name="chevron-back" size={24} />
				</Pressable>
			) : (
				<View style={styles.headerButton} />
			)}
			<Text style={globalStyles.sectionTitleText}>{title}</Text>
			<View style={styles.headerButton} />
		</View>
	);
}

export function SettingsGroup({ children }: { children: ReactNode }) {
	const { styles } = useThemeStyles();
	return <View style={styles.group}>{children}</View>;
}

export function SettingsRow({
	disabled = false,
	icon,
	iconBackground = "#F7F8FC",
	iconColor,
	onPress,
	subtitle,
	title,
	trailing,
}: {
	disabled?: boolean;
	icon: IconName;
	iconBackground?: string;
	iconColor?: string;
	onPress?: () => void;
	subtitle?: string;
	title: string;
	trailing?: ReactNode;
}) {
	const { themeColors, styles } = useThemeStyles();
	const resolvedIconColor = iconColor ?? themeColors.textSecondary;
	return (
		<Pressable
			accessibilityRole={onPress ? "button" : undefined}
			disabled={!onPress || disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				pressed && onPress && !disabled && styles.pressed,
				disabled && styles.disabled,
			]}
		>
			<View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
				<Ionicons color={resolvedIconColor} name={icon} size={22} />
			</View>
			<View style={styles.rowTextWrap}>
				<Text style={styles.rowTitle}>{title}</Text>
				{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
			</View>
			{trailing ?? (
				onPress ? (
					<Ionicons color={themeColors.textSecondary} name="chevron-forward" size={20} />
				) : null
			)}
		</Pressable>
	);
}

export function PlaceholderCard({
	icon,
	message,
	title,
}: {
	icon: IconName;
	message: string;
	title: string;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	
	return (
		<View style={[globalStyles.card, styles.placeholderCard]}>
			<View style={styles.placeholderIcon}>
				<Ionicons color={themeColors.primary} name={icon} size={28} />
			</View>
			<Text style={styles.placeholderTitle}>{title}</Text>
			<Text style={styles.placeholderText}>{message}</Text>
		</View>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	disabled: {
		opacity: 0.55,
	},
	group: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 16,
		borderWidth: 1,
		overflow: "hidden",
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	headerButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 40,
		minWidth: 40,
	},
	iconWrap: {
		alignItems: "center",
		borderRadius: 12,
		height: 42,
		justifyContent: "center",
		width: 42,
	},
	placeholderCard: {
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: spacing.xl,
	},
	placeholderIcon: {
		alignItems: "center",
		backgroundColor: "#F1ECFF",
		borderRadius: 18,
		height: 56,
		justifyContent: "center",
		width: 56,
	},
	placeholderText: {
		...typography.body,
		color: themeColors.textSecondary,
		textAlign: "center",
	},
	placeholderTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
	},
	pressed: {
		opacity: 0.72,
	},
	row: {
		alignItems: "center",
		borderBottomColor: themeColors.border,
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: spacing.md,
		minHeight: 72,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	rowSubtitle: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: 2,
	},
	rowTextWrap: {
		flex: 1,
	},
	rowTitle: {
		...typography.label,
		color: themeColors.textPrimary,
	},
});
}
