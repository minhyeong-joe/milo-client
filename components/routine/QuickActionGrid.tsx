import { useMemo } from "react";
import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoutineIcon } from "./RoutineIcon";

function QuickActionButton({
	action,
	config,
	onPress,
}: {
	action: { id: RoutineKind; lastActionLabel: string };
	config: RoutineConfig;
	onPress?: (kind: RoutineKind) => void;
}) {
	const { globalStyles, styles } = useThemeStyles();
	const iconInfo: RoutineConfig["quickActions"][RoutineKind] = config.quickActions[action.id];

	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => onPress?.(action.id)}
			style={styles.quickAction}
		>
			<View style={styles.quickIcon}>
				<RoutineIcon size={56} kind={action.id} />
			</View>
			<Text style={[globalStyles.labelText, styles.quickLabel]}>
				{iconInfo.label}
			</Text>
			<Text style={styles.quickDetail}>{action.lastActionLabel}</Text>
		</Pressable>
	);
}

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function QuickActionGrid({
	actions,
	config,
	onActionPress,
}: {
	actions: { id: RoutineKind; lastActionLabel: string }[];
	config: RoutineConfig;
	onActionPress?: (kind: RoutineKind) => void;
}) {
	const { styles } = useThemeStyles();
	return (
		<View style={styles.quickGrid}>
			{actions.map((action) => (
				<QuickActionButton
					action={action}
					config={config}
					key={action.id}
					onPress={onActionPress}
				/>
			))}
		</View>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	quickAction: {
		alignItems: "center",
		flex: 1,
	},
	quickDetail: {
		color: themeColors.textSecondary,
		fontSize: 12,
		fontWeight: "600",
		marginTop: spacing.xs,
		textAlign: "center",
	},
	quickGrid: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: spacing.md,
		marginTop: spacing.xs,
	},
	quickIcon: {
		alignItems: "center",
		height: 56,
		justifyContent: "center",
		marginBottom: spacing.sm,
		width: 64,
	},
	quickLabel: {
		textAlign: "center",
	},
});
}
