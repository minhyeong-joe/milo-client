import type { RoutineConfig, RoutineEvent, RoutineStyle } from "@/data/homeData";
import { colors, globalStyles } from "@/styles/globalStyles";
import {
	formatClockTime,
	formatDuration,
	formatSolidAmount,
	formatVolume,
	getSleepDurationMinutes,
} from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoutineIcon } from "./RoutineIcon";
import { router } from "expo-router";

function getEventDisplay(
	event: RoutineEvent,
	config: RoutineConfig,
	currentTime: string,
): { detail: string; style: RoutineStyle; title: string } {
	if (event.kind === "meal") {
		const title = config.mealTypes[event.type];
		const detail =
			event.type === "breastfeed" && event.durationMinutes
				? `${event.durationMinutes} min`
				: event.amountMl
					? formatVolume(event.amountMl, config.preferredVolumeUnit)
					: event.amountServings || event.amountGrams
						? formatSolidAmount({
								amountServings: event.amountServings,
								amountGrams: event.amountGrams,
							})
						: "";

		return { detail, style: config.quickActions.meal, title };
	}

	if (event.kind === "sleep") {
		const endTime = event.endTime ? event.endTime : currentTime;
		const durationMinutes = getSleepDurationMinutes(event.startTime, endTime);

		return {
			detail: formatDuration(durationMinutes),
			style: config.quickActions.sleep,
			title: config.sleepTypes[event.type],
		};
	}

	if (event.kind === "diaper") {
		return {
			detail: "",
			style: config.quickActions.diaper,
			title: `Diaper (${config.diaperTypes[event.type]})`,
		};
	}

	throw new Error("Unsupported routine event");
}

export function TimelineRow({
	config,
	currentTime,
	event,
	isLast,
	timeZone,
}: {
	config: RoutineConfig;
	currentTime: string;
	event: RoutineEvent;
	isLast: boolean;
	timeZone?: string;
}) {
	const display = getEventDisplay(event, config, currentTime);
	const isSleep = event.kind === "sleep";

	const onEventClick = () => {
		if (event.kind === "meal") {
			router.push({
				pathname: "/routine/add-meal",
				params: { mealId: event.id},
			});
		} else if (event.kind === "diaper") {
			router.push({
				pathname: "/routine/add-diaper",
				params: { diaperId: event.id},
			});
		} else if (event.kind === "sleep") {
			router.push({
				pathname: "/routine/add-sleep",
				params: { sleepId: event.id},
			});
		}
	}

	return (
		<View style={styles.timelineRow}>
			{isSleep ? (
				<Text style={styles.timelineTime}>
					{`${formatClockTime(event.startTime, timeZone)}\n ${event.endTime ? `- ${formatClockTime(event.endTime, timeZone)}` : "- Now"}`}
				</Text>
			) : (
				<Text style={styles.timelineTime}>{formatClockTime(event.time, timeZone)}</Text>
			)}

			<View style={styles.timelineRail}>
				<View style={styles.timelineDot} />
				{!isLast ? <View style={styles.timelineLine} /> : null}
			</View>
			<Pressable
				accessibilityRole="button" 
				style={[styles.timelineCard, isSleep && styles.sleepCard]}
				onPress={onEventClick}
			>
				<View style={styles.timelineIcon}>
					<RoutineIcon size={40} kind={event.kind} />
				</View>
				<View style={styles.timelineText}>
					<Text style={globalStyles.sectionTitleText}>
						{display.title} {event.kind === "meal" && event.breastSide ? `(${event.breastSide.toUpperCase().charAt(0)})` : ""}
					</Text>
					{display.detail ? (
						<Text style={styles.timelineDetail}>{display.detail}</Text>
					) : null}
				</View>
				<Ionicons
					color={colors.light.textSecondary}
					name="chevron-forward"
					size={20}
				/>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	sleepCard: {
		backgroundColor: "#F7FAFF",
	},
	timelineCard: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flex: 1,
		flexDirection: "row",
		minHeight: 58,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	timelineDetail: {
		color: colors.light.textSecondary,
		fontSize: 14,
		fontWeight: "500",
		marginTop: 2,
	},
	timelineDot: {
		backgroundColor: "#C6CBD4",
		borderRadius: 4,
		height: 8,
		width: 8,
	},
	timelineIcon: {
		alignItems: "center",
		height: 40,
		justifyContent: "center",
		marginRight: 12,
		width: 40,
	},
	timelineLine: {
		backgroundColor: colors.light.border,
		flex: 1,
		marginTop: 4,
		width: 2,
	},
	timelineRail: {
		alignItems: "center",
		alignSelf: "stretch",
		paddingTop: 22,
		width: 12,
	},
	timelineRow: {
		flexDirection: "row",
		minHeight: 60,
	},
	timelineText: {
		flex: 1,
	},
	timelineTime: {
		color: colors.light.textSecondary,
		fontSize: 13,
		fontWeight: "600",
		paddingTop: 20,
		width: 74,
	},
});
