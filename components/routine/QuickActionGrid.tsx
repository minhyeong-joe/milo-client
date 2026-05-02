import type { RoutineConfig, RoutineKind } from "@/data/homeData";
import { colors, spacing, globalStyles } from "@/styles/globalStyles";
import { StyleSheet, Text, View } from "react-native";
import { RoutineIcon } from "./RoutineIcon";

function QuickActionButton({
	action,
	config,
}: {
	action: { id: RoutineKind; lastActionLabel: string };
	config: RoutineConfig;
}) {
	const style = config.quickActions[action.id];

	return (
		<View style={styles.quickAction}>
			<View style={styles.quickIcon}>
				<RoutineIcon size={56} style={style} />
			</View>
			<Text style={[globalStyles.labelText, styles.quickLabel]}>
				{style.label}
			</Text>
			<Text style={styles.quickDetail}>{action.lastActionLabel}</Text>
		</View>
	);
}

export function QuickActionGrid({
	actions,
	config,
}: {
	actions: { id: RoutineKind; lastActionLabel: string }[];
	config: RoutineConfig;
}) {
	return (
		<View style={styles.quickGrid}>
			{actions.map((action) => (
				<QuickActionButton action={action} config={config} key={action.id} />
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
