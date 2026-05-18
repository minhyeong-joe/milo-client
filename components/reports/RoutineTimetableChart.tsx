import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { BarChart, type stackDataItem } from "react-native-gifted-charts";
import type {
	RoutinePatternLog,
	RoutineStatsDay,
} from "@/services/api/routine";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import type { RoutineKind } from "@/data/homeData";
import {
	buildRoutinePatternInsights,
	type RoutinePatternInsight,
} from "@/utils/routinePatternInsights";

const DAY_MINUTES = 1440;
const POINT_EVENT_MINUTES = 20;
const TRANSPARENT = "rgba(0,0,0,0)";
const DEFAULT_CHART_WIDTH = 300;
const Y_AXIS_LABEL_WIDTH = 42;
const CHART_RIGHT_GUTTER = 8;
const WEEK_DAY_COUNT = 7;
const MONTH_DAY_COUNT = 30;
const DEFAULT_INSIGHT_LIMIT = 4;
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

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function RoutineTimetableChart({
	days,
	showDiaper,
	showMeal,
	showSleep,
	timeZone,
}: {
	days: RoutineStatsDay[];
	showDiaper: boolean;
	showMeal: boolean;
	showSleep: boolean;
	timeZone?: string;
}) {
	const { globalStyles, styles } = useThemeStyles();
	const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
	const [expandedInsights, setExpandedInsights] = useState<Record<RoutineKind, boolean>>({
		diaper: false,
		meal: false,
		sleep: false,
	});
	const visibleKinds = useMemo(
		() => ({
			diaper: showDiaper,
			meal: showMeal,
			sleep: showSleep,
		}),
		[showDiaper, showMeal, showSleep],
	);
	const hasActiveSleep = useMemo(
		() => days.some((day) =>
			day.logs.some((log) => log.kind === "sleep" && !log.endTime),
		),
		[days],
	);
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		if (!hasActiveSleep) {
			return;
		}

		setNow(new Date());
		const intervalId = setInterval(() => setNow(new Date()), 60000);

		return () => clearInterval(intervalId);
	}, [hasActiveSleep]);

	const chartDays = useMemo(
		() =>
			days.map((day, index) => ({
				...day,
				blocks: buildBlocksForDay(day, timeZone, now),
				shouldShowLabel: shouldShowDateLabel(index, days.length),
				showYear: index === 0 || day.date.slice(0, 4) !== days[index - 1]?.date.slice(0, 4),
			})),
		[days, now, timeZone],
	);
	const insights = useMemo(
		() => buildRoutinePatternInsights(days, timeZone),
		[days, timeZone],
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
		<View>
			<View style={globalStyles.rowBetween}>
				<View>
					<Text style={globalStyles.sectionTitleText}>Timeline Pattern</Text>
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
					scrollToEnd={true}
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
			<Text style={globalStyles.sectionTitleText}>Typical Day</Text>
			<PatternInsightsList
				expandedInsights={expandedInsights}
				insights={insights}
				onToggleExpanded={(kind) =>
					setExpandedInsights((current) => ({
						...current,
						[kind]: !current[kind],
					}))
				}
				visibleKinds={visibleKinds}
			/>
		</View>
	);
}

function PatternInsightsList({
	expandedInsights,
	insights,
	onToggleExpanded,
	visibleKinds,
}: {
	expandedInsights: Record<RoutineKind, boolean>;
	insights: Record<RoutineKind, RoutinePatternInsight[]>;
	onToggleExpanded: (kind: RoutineKind) => void;
	visibleKinds: Record<RoutineKind, boolean>;
}) {
	const { styles } = useThemeStyles();
	const sections = (["meal", "diaper", "sleep"] satisfies RoutineKind[])
		.filter((kind) => visibleKinds[kind]);

	if (sections.length === 0) {
		return null;
	}

	return (
		<View style={styles.insightsContainer}>
			{sections.map((kind) => (
				<PatternInsightSection
					insights={insights[kind]}
					isExpanded={expandedInsights[kind]}
					key={kind}
					kind={kind}
					onToggleExpanded={() => onToggleExpanded(kind)}
				/>
			))}
		</View>
	);
}

function PatternInsightSection({
	insights,
	isExpanded,
	kind,
	onToggleExpanded,
}: {
	insights: RoutinePatternInsight[];
	isExpanded: boolean;
	kind: RoutineKind;
	onToggleExpanded: () => void;
}) {
	const { styles, themeColors } = useThemeStyles();
	const visibleInsights = getVisibleInsights(insights, isExpanded);
	const hasMore = insights.length > DEFAULT_INSIGHT_LIMIT;

	return (
		<View style={styles.insightSection}>
			<View style={styles.insightSectionHeader}>
				<View style={styles.insightTitleRow}>
					<RoutineIcon kind={kind} size={28} />
					<Text style={styles.insightTitle}>{getInsightTitle(kind)}</Text>
				</View>
				{hasMore ? (
					<Pressable
						accessibilityRole="button"
						hitSlop={8}
						onPress={onToggleExpanded}
					>
						<Text style={[styles.showAllText, { color: themeColors.primary }]}>
							{isExpanded ? "Show less" : "Show all"}
						</Text>
					</Pressable>
				) : null}
			</View>
			{visibleInsights.length > 0 ? (
				<View style={styles.insightRows}>
					{visibleInsights.map((insight) => (
						<View key={insight.id} style={styles.insightRow}>
							<Text style={styles.insightTime}>{insight.timeLabel}</Text>
							<Text style={styles.insightDot}>·</Text>
							<Text style={styles.insightLabel}>{insight.label}</Text>
						</View>
					))}
				</View>
			) : (
				<Text style={styles.emptyInsightText}>
					Not enough repeated entries in this range yet.
				</Text>
			)}
		</View>
	);
}

function getVisibleInsights(insights: RoutinePatternInsight[], isExpanded: boolean) {
	const displayInsights = isExpanded
		? insights
		: insights.slice(0, DEFAULT_INSIGHT_LIMIT);

	return [...displayInsights].sort(sortInsightsByTime);
}

function sortInsightsByTime(
	left: RoutinePatternInsight,
	right: RoutinePatternInsight,
) {
	return left.sortMinute - right.sortMinute ||
		left.label.localeCompare(right.label) ||
		right.supportCount - left.supportCount;
}

function buildBlocksForDay(day: RoutineStatsDay, timeZone: string | undefined, now: Date) {
	return day.logs
		.flatMap((log): TimetableBlock[] => {
			if (log.kind === "sleep") {
				return buildSleepBlocks(log, day.date, timeZone, now);
			}

			const startMinute = getMinuteOfDay(log.time, day.date, timeZone);
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
	timeZone?: string,
	now = new Date(),
) {
	const start = getLocalTimeParts(log.startTime, timeZone);
	const end = getLocalTimeParts(log.endTime ?? now.toISOString(), timeZone);

	if (!start || !end || end.dateKey < dayDate || start.dateKey > dayDate) {
		return [];
	}

	const startMinute = start.dateKey === dayDate ? start.minuteOfDay : 0;
	const endMinute = end.dateKey === dayDate ? end.minuteOfDay : DAY_MINUTES;

	if (endMinute <= startMinute) {
		return [];
	}

	return [createSleepBlock(log, startMinute, endMinute, getSleepBlockSuffix(log, dayDate, start, end))];
}

function createSleepBlock(
	log: Extract<RoutinePatternLog, { kind: "sleep" }>,
	startMinute: number,
	endMinute: number,
	suffix: string,
): TimetableBlock {
	return {
		color: KIND_COLORS.sleep,
		endMinute,
		id: `${log.id}:${suffix}`,
		kind: "sleep",
		label: `Sleep (${log.type})`,
		startMinute,
		type: log.type,
	};
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

function getMinuteOfDay(value: string, dayDate: string, timeZone?: string) {
	const parts = getLocalTimeParts(value, timeZone);

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

function getLocalTimeParts(value: string, timeZone?: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	if (timeZone) {
		const parts = new Intl.DateTimeFormat("en-US", {
			day: "2-digit",
			hour: "2-digit",
			hourCycle: "h23",
			minute: "2-digit",
			month: "2-digit",
			timeZone,
			year: "numeric",
		}).formatToParts(date);
		const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

		return {
			dateKey: `${byType.year}-${byType.month}-${byType.day}`,
			minuteOfDay: Math.min(
				DAY_MINUTES,
				Math.max(0, Number(byType.hour) * 60 + Number(byType.minute)),
			),
		};
	}

	return {
		dateKey: getLocalDateKey(date),
		minuteOfDay: Math.min(
			DAY_MINUTES,
			Math.max(0, date.getHours() * 60 + date.getMinutes()),
		),
	};
}

function getSleepBlockSuffix(
	log: Extract<RoutinePatternLog, { kind: "sleep" }>,
	dayDate: string,
	start: { dateKey: string },
	end: { dateKey: string },
) {
	if (!log.endTime) {
		return start.dateKey === dayDate ? "active-start" : "active-day";
	}

	if (start.dateKey === dayDate && end.dateKey === dayDate) {
		return "same-day";
	}

	if (start.dateKey === dayDate) {
		return "start-day";
	}

	if (end.dateKey === dayDate) {
		return "end-day";
	}

	return "full-day";
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
	const { styles } = useThemeStyles();
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
	const { styles } = useThemeStyles();
	return (
		<View style={styles.legendItem}>
			<View style={[styles.legendDot, { backgroundColor: color }]} />
			<Text style={styles.legendText}>{label}</Text>
		</View>
	);
}

function getInsightTitle(kind: RoutineKind) {
	if (kind === "meal") return "Meals";
	if (kind === "diaper") return "Diapers";
	return "Sleep";
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	axisDateLabel: {
		alignItems: "center",
	},
	axisDateText: {
		...typography.caption,
		color: themeColors.textSecondary,
		fontSize: 10,
		lineHeight: 12,
		textAlign: "center",
	},
	axisLabel: {
		color: themeColors.textSecondary,
		fontSize: 10,
	},
	axisYearText: {
		...typography.caption,
		color: themeColors.textSecondary,
		fontSize: 9,
		lineHeight: 11,
		textAlign: "center",
	},
	chartWrapper: {
		overflow: "hidden",
	},
	emptyInsightText: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: spacing.xs,
	},
	insightDot: {
		color: themeColors.textSecondary,
		fontSize: 13,
		fontWeight: "800",
		lineHeight: 18,
	},
	insightLabel: {
		color: themeColors.textPrimary,
		flexShrink: 1,
		fontSize: 13,
		fontWeight: "700",
		lineHeight: 18,
	},
	insightRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.xs,
		minHeight: 22,
	},
	insightRows: {
		gap: 2,
		marginTop: spacing.xs,
	},
	insightSection: {
		borderTopColor: themeColors.border,
		borderTopWidth: 1,
		paddingTop: spacing.sm,
	},
	insightSectionHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	insightsContainer: {
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	insightTime: {
		color: themeColors.textPrimary,
		fontSize: 13,
		fontWeight: "800",
		lineHeight: 18,
		minWidth: 72,
	},
	insightTitle: {
		...typography.label,
		color: themeColors.textPrimary,
		fontSize: 14,
	},
	insightTitleRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.xs,
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
		color: themeColors.textSecondary,
		fontSize: 10,
	},
	showAllText: {
		fontSize: 12,
		fontWeight: "800",
	},
	subtitle: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: 2,
	},
});
}
