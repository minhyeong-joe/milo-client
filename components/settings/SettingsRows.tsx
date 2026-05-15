import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function SettingsHeader({
	onBack,
	title,
}: {
	onBack?: () => void;
	title: string;
}) {
	return (
		<View style={styles.header}>
			{onBack ? (
				<Pressable accessibilityRole="button" onPress={onBack} style={styles.headerButton}>
					<Ionicons color={colors.light.textPrimary} name="chevron-back" size={24} />
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
	return <View style={styles.group}>{children}</View>;
}

export function SettingsRow({
	disabled = false,
	icon,
	iconBackground = "#F7F8FC",
	iconColor = colors.light.textSecondary,
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
				<Ionicons color={iconColor} name={icon} size={22} />
			</View>
			<View style={styles.rowTextWrap}>
				<Text style={styles.rowTitle}>{title}</Text>
				{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
			</View>
			{trailing ?? (
				onPress ? (
					<Ionicons color={colors.light.textSecondary} name="chevron-forward" size={20} />
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
	return (
		<View style={[globalStyles.card, styles.placeholderCard]}>
			<View style={styles.placeholderIcon}>
				<Ionicons color={colors.light.primary} name={icon} size={28} />
			</View>
			<Text style={styles.placeholderTitle}>{title}</Text>
			<Text style={styles.placeholderText}>{message}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	disabled: {
		opacity: 0.55,
	},
	group: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
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
		color: colors.light.textSecondary,
		textAlign: "center",
	},
	placeholderTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	pressed: {
		opacity: 0.72,
	},
	row: {
		alignItems: "center",
		borderBottomColor: colors.light.border,
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: spacing.md,
		minHeight: 72,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	rowSubtitle: {
		...typography.caption,
		color: colors.light.textSecondary,
		marginTop: 2,
	},
	rowTextWrap: {
		flex: 1,
	},
	rowTitle: {
		...typography.label,
		color: colors.light.textPrimary,
	},
});
