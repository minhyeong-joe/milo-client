import type { RoutineConfig, RoutineDay } from "@/data/homeData";
import { type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { formatDayLabel } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import { useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoutineAIInsight } from "./RoutineAIInsight";
import { RoutineCard } from "./RoutineCard";
import { RoutineSummary } from "./RoutineSummary";
import { Timeline } from "./Timeline";

export type RoutineDayCardView = "summary" | "timeline";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function RoutineDayCard({
	config,
	currentTime,
	day,
	defaultView,
	timeZone,
}: {
	config: RoutineConfig;
	currentTime: string;
	day: RoutineDay;
	defaultView: RoutineDayCardView;
	timeZone?: string;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles(); 
	const [view, setView] = useState<RoutineDayCardView>(defaultView);
	const isTimeline = view === "timeline";
	const dayLabel = formatDayLabel(day.date, currentTime, timeZone);
	const isToday = dayLabel.label === "Today";

	const toggleView = () => {
		setView((prev) => (prev === "timeline" ? "summary" : "timeline"));
	}

	return (
		<RoutineCard>
			<Pressable 
				style={[globalStyles.rowBetween, styles.cardHeader]}
				accessibilityRole="button"
				onPress={toggleView}
			>
				<View>
					<Text style={styles.dayTitle}>{dayLabel.label}</Text>
					<Text style={styles.dayDate}>{dayLabel.date}</Text>
				</View>
				{view === "timeline" ? (
					<Ionicons name="chevron-up" size={24} color={themeColors.textSecondary} />
				) : (
					<Ionicons name="chevron-down" size={24} color={themeColors.textSecondary} />
				)}
			</Pressable>

			{isTimeline ? (
				<Timeline config={config} currentTime={currentTime} events={day.timeline} timeZone={timeZone} />
			) : (
				<>
					<RoutineSummary config={config} summary={day.summary} />
					{!isToday ? <RoutineAIInsight /> : null}
				</>
			)}
		</RoutineCard>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	cardHeader: {
		alignItems: "flex-start",
	},
	chevronButton: {
		alignItems: "center",
		height: 36,
		justifyContent: "center",
		width: 36,
	},
	dayDate: {
		color: themeColors.textSecondary,
		fontSize: 16,
		fontWeight: "600",
		marginTop: 4,
	},
	dayTitle: {
		color: themeColors.textPrimary,
		fontSize: 24,
		fontWeight: "800",
	},
	summaryPill: {
		borderColor: themeColors.border,
		borderRadius: 18,
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	summaryPillText: {
		color: themeColors.textSecondary,
		fontSize: 14,
		fontWeight: "700",
	},
});
}
