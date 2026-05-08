import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { colors, spacing, globalStyles } from "@/styles/globalStyles";
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

export function QuickActionGrid({
	actions,
	config,
	onActionPress,
}: {
	actions: { id: RoutineKind; lastActionLabel: string }[];
	config: RoutineConfig;
	onActionPress?: (kind: RoutineKind) => void;
}) {
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

const styles = StyleSheet.create({
	quickAction: {
		alignItems: "center",
		flex: 1,
	},
	quickDetail: {
		color: colors.light.textSecondary,
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
