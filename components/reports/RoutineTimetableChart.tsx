import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { BarChart, type stackDataItem } from "react-native-gifted-charts";
import type {
	RoutinePatternLog,
	RoutineStatsDay,
} from "@/services/api/routine";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";

const DAY_MINUTES = 1440;
const POINT_EVENT_MINUTES = 20;
const TRANSPARENT = "rgba(0,0,0,0)";
const DEFAULT_CHART_WIDTH = 300;
const Y_AXIS_LABEL_WIDTH = 42;
const CHART_RIGHT_GUTTER = 8;
const WEEK_DAY_COUNT = 7;
const MONTH_DAY_COUNT = 30;
const KIND_COLORS = {
	diaper: "#2FB86E",
	meal: "#7C4DFF",
	sleep: "#326BC7",
} as const;

type TimetableBlock = {
	color: string;
	endMinute: number;
	id: string;
	kind: RoutinePatternLog["kind"];
	label: string;
	startMinute: number;
	type: string;
};

export default function RoutineTimetableChart({
	days,
	showDiaper,
	showMeal,
	showSleep,
}: {
	days: RoutineStatsDay[];
	showDiaper: boolean;
	showMeal: boolean;
	showSleep: boolean;
}) {
	const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
	const visibleKinds = useMemo(
		() => ({
			diaper: showDiaper,
			meal: showMeal,
			sleep: showSleep,
		}),
		[showDiaper, showMeal, showSleep],
	);
	const chartDays = useMemo(
		() =>
			days.map((day, index) => ({
				...day,
				blocks: buildBlocksForDay(day),
				shouldShowLabel: shouldShowDateLabel(index, days.length),
				showYear: index === 0 || day.date.slice(0, 4) !== days[index - 1]?.date.slice(0, 4),
			})),
		[days],
	);
	const isScrollable = days.length > WEEK_DAY_COUNT;
	const initialSpacing = 4;
	const endSpacing = 4;
	const spacingValue = isScrollable ? 1 : 2;
	const plotWidth = Math.max(
		220,
		chartWidth - Y_AXIS_LABEL_WIDTH - CHART_RIGHT_GUTTER,
	);
	const barWidth = isScrollable
		? 18
		: Math.max(
				20,
				Math.floor(
					(plotWidth -
						initialSpacing -
						endSpacing -
						spacingValue * Math.max(0, days.length - 1)) /
						Math.max(1, days.length),
				),
			);
	const labelWidth = isScrollable ? 44 : Math.max(28, barWidth + spacingValue);
	const stackData = useMemo(
		() =>
			chartDays.map<stackDataItem>((day) => ({
				labelComponent: () => (
					<AxisDateLabel
						compact={isScrollable}
						date={day.date}
						labelWidth={labelWidth}
						labelXOffset={isScrollable ? -(labelWidth - barWidth) / 2 : 0}
						showLabel={day.shouldShowLabel}
						showYear={day.showYear}
					/>
				),
				stacks: buildStacks(day.blocks.filter((block) => visibleKinds[block.kind])),
			})),
		[barWidth, chartDays, isScrollable, labelWidth, visibleKinds],
	);

	return (
		<View style={[globalStyles.card, styles.card]}>
			<View style={globalStyles.rowBetween}>
				<View>
					<Text style={styles.title}>Daily Timetable</Text>
				</View>
				<View style={styles.legendRow}>
					<LegendDot color={KIND_COLORS.meal} label="Meal" />
					<LegendDot color={KIND_COLORS.diaper} label="Diaper" />
					<LegendDot color={KIND_COLORS.sleep} label="Sleep" />
				</View>
			</View>

			<View style={styles.chartWrapper} onLayout={handleChartLayout(setChartWidth)}>
				<BarChart
					barWidth={barWidth}
					disablePress
					disableScroll={!isScrollable}
					endSpacing={endSpacing}
					height={250}
					initialSpacing={initialSpacing}
					labelWidth={labelWidth}
					maxValue={DAY_MINUTES}
					nestedScrollEnabled
					noOfSections={4}
					rulesColor="#EEF0F5"
					rulesType="solid"
					scrollToEnd={false}
					showScrollIndicator={isScrollable}
					spacing={spacingValue}
					stackData={stackData}
					key={isScrollable ? "routine-timetable-scrollable" : "routine-timetable-static"}
					width={plotWidth}
					xAxisColor="#D9DEE8"
					xAxisLabelsHeight={44}
					xAxisLabelsVerticalShift={8}
					xAxisThickness={1}
					yAxisColor="#D9DEE8"
					// Gifted Charts maps these labels from bottom to top.
					yAxisLabelTexts={["12AM", "6PM", "12PM", "6AM", "12AM"]}
					yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
					yAxisTextStyle={styles.axisLabel}
				/>
			</View>
		</View>
	);
}

function buildBlocksForDay(day: RoutineStatsDay) {
	return day.logs
		.flatMap((log): TimetableBlock[] => {
			if (log.kind === "sleep") {
				return buildSleepBlocks(log, day.date);
			}

			const startMinute = getMinuteOfDay(log.time, day.date);
			const endMinute = Math.min(DAY_MINUTES, startMinute + POINT_EVENT_MINUTES);

			return [{
				color: KIND_COLORS[log.kind],
				endMinute,
				id: log.id,
				kind: log.kind,
				label: `${capitalize(log.kind)} (${log.type})`,
				startMinute,
				type: log.type,
			}];
		})
		.sort((left, right) => left.startMinute - right.startMinute);
}

function buildSleepBlocks(
	log: Extract<RoutinePatternLog, { kind: "sleep" }>,
	dayDate: string,
) {
	const start = getLocalTimeParts(log.startTime);
	const end = log.endTime ? getLocalTimeParts(log.endTime) : null;

	if (!start) {
		return [];
	}

	const blocks: TimetableBlock[] = [];
	const label = `Sleep (${log.type})`;
	const createBlock = (startMinute: number, endMinute: number, suffix: string) => {
		if (endMinute <= startMinute) {
			return;
		}

		blocks.push({
			color: KIND_COLORS.sleep,
			endMinute,
			id: `${log.id}:${suffix}`,
			kind: "sleep",
			label,
			startMinute,
			type: log.type,
		});
	};

	if (!end) {
		if (start.dateKey < dayDate) {
			createBlock(0, DAY_MINUTES, "active-day");
		} else if (start.dateKey === dayDate) {
			createBlock(start.minuteOfDay, DAY_MINUTES, "active-start");
		}

		return blocks;
	}

	if (start.dateKey === end.dateKey) {
		if (start.dateKey === dayDate) {
			createBlock(start.minuteOfDay, end.minuteOfDay, "same-day");
		}

		return blocks;
	}

	if (start.dateKey < dayDate && end.dateKey === dayDate) {
		createBlock(start.minuteOfDay, DAY_MINUTES, "previous-evening");
		createBlock(0, end.minuteOfDay, "wake-morning");
		return blocks;
	}

	if (start.dateKey === dayDate) {
		createBlock(start.minuteOfDay, DAY_MINUTES, "start-day");
	} else if (start.dateKey < dayDate && end.dateKey > dayDate) {
		createBlock(0, DAY_MINUTES, "full-day");
	} else if (end.dateKey === dayDate) {
		createBlock(0, end.minuteOfDay, "end-day");
	}

	return blocks;
}

function buildStacks(blocks: TimetableBlock[]) {
	const stacks: stackDataItem["stacks"] = [];
	let cursor = DAY_MINUTES;

	const displayBlocks = blocks
		.map((block) => ({
			...block,
			endMinute: clampMinute(block.endMinute),
			startMinute: clampMinute(block.startMinute),
		}))
		.filter((block) => block.endMinute > block.startMinute)
		.sort((left, right) => right.endMinute - left.endMinute);

	for (const block of displayBlocks) {
		const endMinute = Math.min(cursor, block.endMinute);
		const startMinute = Math.min(endMinute, block.startMinute);

		if (cursor > endMinute) {
			stacks.push(createGapStack(cursor - endMinute));
		}

		if (endMinute > startMinute) {
			stacks.push({
				borderRadius: 5,
				color: block.color,
				value: endMinute - startMinute,
			});
		}

		cursor = startMinute;
	}

	if (cursor > 0) {
		stacks.push(createGapStack(cursor));
	}

	if (stacks.length === 0) {
		stacks.push(createGapStack(DAY_MINUTES));
	}

	return stacks;
}

function createGapStack(value: number) {
	return {
		color: TRANSPARENT,
		value,
	};
}

function clampMinute(value: number) {
	return Math.min(DAY_MINUTES, Math.max(0, value));
}

function handleChartLayout(setChartWidth: (width: number) => void) {
	return (event: LayoutChangeEvent) => {
		const nextWidth = Math.floor(event.nativeEvent.layout.width);

		if (nextWidth > 0) {
			setChartWidth(nextWidth);
		}
	};
}

function getMinuteOfDay(value: string, dayDate: string) {
	const parts = getLocalTimeParts(value);

	if (!parts) {
		return 0;
	}

	if (parts.dateKey < dayDate) {
		return 0;
	}
	if (parts.dateKey > dayDate) {
		return DAY_MINUTES;
	}

	return parts.minuteOfDay;
}

function getLocalTimeParts(value: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return {
		dateKey: getLocalDateKey(date),
		minuteOfDay: Math.min(
			DAY_MINUTES,
			Math.max(0, date.getHours() * 60 + date.getMinutes()),
		),
	};
}

function getLocalDateKey(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function formatShortDate(date: string, compact: boolean) {
	const [, month, day] = date.split("-");

	return `${Number(month)}/${Number(day)}`;
}

function formatYearLabel(date: string, compact: boolean) {
	const year = date.slice(0, 4);

	return year;
}

function capitalize(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function shouldShowDateLabel(index: number, dayCount: number) {
	if (index === 0 || index === dayCount - 1) {
		return true;
	}
	if (dayCount <= WEEK_DAY_COUNT) {
		return index % 2 === 0;
	}
	if (dayCount <= MONTH_DAY_COUNT) {
		return index % 5 === 0;
	}

	return index % 7 === 0;
}

function AxisDateLabel({
	compact,
	date,
	labelWidth,
	labelXOffset,
	showLabel,
	showYear,
}: {
	compact: boolean;
	date: string;
	labelWidth: number;
	labelXOffset: number;
	showLabel: boolean;
	showYear: boolean;
}) {
	return (
		<View
			style={[
				styles.axisDateLabel,
				{
					transform: [{ translateX: labelXOffset }],
					width: labelWidth,
				},
			]}
		>
			<Text
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				numberOfLines={1}
				style={styles.axisDateText}
			>
				{showLabel ? formatShortDate(date, compact) : " "}
			</Text>
			<Text
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				numberOfLines={1}
				style={styles.axisYearText}
			>
				{showLabel && showYear ? formatYearLabel(date, compact) : " "}
			</Text>
		</View>
	);
}

function LegendDot({
	color,
	label,
}: {
	color: string;
	label: string;
}) {
	return (
		<View style={styles.legendItem}>
			<View style={[styles.legendDot, { backgroundColor: color }]} />
			<Text style={styles.legendText}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	axisDateLabel: {
		alignItems: "center",
	},
	axisDateText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontSize: 10,
		lineHeight: 12,
		textAlign: "center",
	},
	axisLabel: {
		color: colors.light.textSecondary,
		fontSize: 10,
	},
	axisYearText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontSize: 9,
		lineHeight: 11,
		textAlign: "center",
	},
	card: {
		gap: spacing.md,
	},
	chartWrapper: {
		overflow: "hidden",
	},
	legendDot: {
		borderRadius: 999,
		height: 8,
		width: 8,
	},
	legendItem: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	legendRow: {
		alignItems: "flex-end",
		flexShrink: 1,
		flexWrap: "wrap",
		gap: spacing.xs,
		justifyContent: "flex-end",
	},
	legendText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontSize: 10,
	},
	subtitle: {
		...typography.caption,
		color: colors.light.textSecondary,
		marginTop: 2,
	},
	title: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
});
