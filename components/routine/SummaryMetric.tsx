import type { HomeIconName } from "@/data/homeData";
import { colors } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

export function SummaryMetric({
	backgroundColor,
	children,
	icon,
	iconColor,
}: {
	backgroundColor: string;
	children: ReactNode;
	icon: HomeIconName;
	iconColor: string;
}) {
	return (
		<View style={styles.summaryMetric}>
			<View style={[styles.summaryIcon, { backgroundColor }]}>
				<Ionicons color={iconColor} name={icon} size={19} />
			</View>
			<View>{children}</View>
		</View>
	);
}

export function SummaryText({ children }: { children: ReactNode }) {
	return <Text style={styles.summaryPrimary}>{children}</Text>;
}

export function SummaryDetail({ children }: { children: ReactNode }) {
	return <Text style={styles.summaryDetail}>{children}</Text>;
}

const styles = StyleSheet.create({
	summaryIcon: {
		alignItems: "center",
		borderRadius: 17,
		height: 34,
		justifyContent: "center",
		width: 34,
	},
	summaryMetric: {
		alignItems: "center",
		flex: 1,
		flexDirection: "row",
		gap: 10,
	},
	summaryPrimary: {
		color: colors.light.textPrimary,
		fontSize: 13,
		fontWeight: "700",
		lineHeight: 18,
	},
	summaryDetail: {
		color: colors.light.textSecondary,
		fontSize: 11,
		fontWeight: "600",
		lineHeight: 16,
	},
});
