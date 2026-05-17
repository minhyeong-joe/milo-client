import { useAppTheme } from "@/context/AppPreferencesContext";
import { useMemo } from "react";
import type { HomeIconName } from "@/data/homeData";
import { type ThemeColors } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

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
	const { styles } = useThemeStyles();
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
	const { styles } = useThemeStyles();
	return <Text style={styles.summaryPrimary}>{children}</Text>;
}

export function SummaryDetail({ children }: { children: ReactNode }) {
	const { styles } = useThemeStyles();
	return <Text style={styles.summaryDetail}>{children}</Text>;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
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
		color: themeColors.textPrimary,
		fontSize: 13,
		fontWeight: "700",
		lineHeight: 18,
	},
	summaryDetail: {
		color: themeColors.textSecondary,
		fontSize: 11,
		fontWeight: "600",
		lineHeight: 16,
	},
});
}
