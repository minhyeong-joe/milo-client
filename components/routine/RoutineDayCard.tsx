import type { RoutineConfig, RoutineDay } from "@/data/homeData";
import { colors, globalStyles } from "@/styles/globalStyles";
import { formatDayLabel } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoutineCard } from "./RoutineCard";
import { RoutineSummary } from "./RoutineSummary";
import { Timeline } from "./Timeline";

export type RoutineDayCardView = "summary" | "timeline";

export function RoutineDayCard({
	config,
	currentTime,
	day,
	defaultView,
}: {
	config: RoutineConfig;
	currentTime: string;
	day: RoutineDay;
	defaultView: RoutineDayCardView;
}) {
	const [view, setView] = useState<RoutineDayCardView>(defaultView);
	const isTimeline = view === "timeline";
	const dayLabel = formatDayLabel(day.date, currentTime);

	return (
		<RoutineCard>
			<View style={[globalStyles.rowBetween, styles.cardHeader]}>
				<View>
					<Text style={styles.dayTitle}>{dayLabel.label}</Text>
					<Text style={styles.dayDate}>{dayLabel.date}</Text>
				</View>

				{isTimeline ? (
					<Pressable
						accessibilityRole="button"
						onPress={() => setView("summary")}
						style={styles.summaryPill}
					>
						<Text style={styles.summaryPillText}>Summary</Text>
					</Pressable>
				) : (
					<Pressable
						accessibilityLabel={`Show ${dayLabel.label} timeline`}
						accessibilityRole="button"
						onPress={() => setView("timeline")}
						style={styles.chevronButton}
					>
						<Ionicons
							color={colors.light.textSecondary}
							name="chevron-down"
							size={20}
						/>
					</Pressable>
				)}
			</View>

			{isTimeline ? (
				<Timeline config={config} currentTime={currentTime} events={day.timeline} />
			) : (
				<RoutineSummary config={config} summary={day.summary} />
			)}
		</RoutineCard>
	);
}

const styles = StyleSheet.create({
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
		color: colors.light.textSecondary,
		fontSize: 16,
		fontWeight: "600",
		marginTop: 4,
	},
	dayTitle: {
		color: colors.light.textPrimary,
		fontSize: 24,
		fontWeight: "800",
	},
	summaryPill: {
		borderColor: colors.light.border,
		borderRadius: 18,
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	summaryPillText: {
		color: colors.light.textSecondary,
		fontSize: 14,
		fontWeight: "700",
	},
});
