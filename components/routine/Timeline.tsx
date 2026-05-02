import type { RoutineConfig, RoutineEvent } from "@/data/homeData";
import { colors, globalStyles } from "@/styles/globalStyles";
import { StyleSheet, Text, View } from "react-native";
import { TimelineRow } from "./TimelineRow";

export function Timeline({
	config,
	currentTime,
	events,
}: {
	config: RoutineConfig;
	currentTime: string;
	events: RoutineEvent[];
}) {
	return (
		<View>
			<View style={styles.timelineHeading}>
				<Text style={globalStyles.sectionTitleText}>Timeline</Text>
				<View style={styles.helpCircle}>
					<Text style={styles.helpText}>?</Text>
				</View>
			</View>

			<View>
				{events.map((event, index) => (
					<TimelineRow
						config={config}
						currentTime={currentTime}
						event={event}
						isLast={index === events.length - 1}
						key={event.id}
					/>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	helpCircle: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 9,
		borderWidth: 1,
		height: 18,
		justifyContent: "center",
		width: 18,
	},
	helpText: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "800",
	},
	timelineHeading: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		marginBottom: 10,
	},
});
