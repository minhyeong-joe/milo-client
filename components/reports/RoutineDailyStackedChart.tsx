import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { BarChart, type stackDataItem } from "react-native-gifted-charts";
import type { DiaperType, MealType, PreferredVolumeUnit, RoutineKind, SleepType } from "@/data/homeData";
import type {
	MealPatternLog,
	RoutinePatternLog,
	RoutineStatsDay,
	SleepPatternLog,
} from "@/services/api/routine";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { formatDuration, formatVolume } from "@/utils/routineDisplay";
import { useAppPreferences } from "@/context/AppPreferencesContext";

const DEFAULT_CHART_WIDTH = 300;
const Y_AXIS_LABEL_WIDTH = 34;
const CHART_RIGHT_GUTTER = 8;
const WEEK_DAY_COUNT = 7;
const MONTH_DAY_COUNT = 30;

const TYPE_COLORS = {
	meal: {
		breastfeed: "#7C4DFF",
		breastMilk: "#31888b",
		formula: "#48caae",
		solid: "#EC4899",
	},
	diaper: {
		wet: "#4da6da",
		dirty: "#A16207",
		both: "#5a4d06",
		dry: "#94A3B8",
	},
	sleep: {
		nap: "#3a77da",
		nighttime: "#163079",
	},
} as const;

const TYPE_LABELS = {
	meal: {
		breastfeed: "Breastfeed",
		breastMilk: "Breast milk",
		formula: "Formula",
		solid: "Solid",
	},
	diaper: {
		wet: "Wet",
		dirty: "Dirty",
		both: "Both",
		dry: "Dry",
	},
	sleep: {
		nap: "Nap",
		nighttime: "Night",
	},
} as const;

type RoutineSubtype = MealType | DiaperType | SleepType;

type SelectedSegment = {
	date: string;
	kind: RoutineKind;
	type: RoutineSubtype;
};

type AggregatedSegment = {
	color: string;
	count: number;
	detail: string;
	type: RoutineSubtype;
};

type AggregatedDay = {
	date: string;
	segments: AggregatedSegment[];
	shouldShowLabel: boolean;
	showYear: boolean;
	totalCount: number;
};

export default function RoutineDailyStackedChart({
	days,
	kind,
}: {
	days: RoutineStatsDay[];
	kind: RoutineKind;
}) {
	const {
		preferredVolumeUnit,
	} = useAppPreferences();
	const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
	const aggregatedDays = useMemo(
		() => buildAggregatedDays(days, kind, preferredVolumeUnit),
		[days, kind, preferredVolumeUnit],
	);
	const latestSegment = useMemo(
		() => findLatestSegment(aggregatedDays, kind),
		[aggregatedDays, kind],
	);
	const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(latestSegment);

	useEffect(() => {
		setSelectedSegment(latestSegment);
	}, [latestSegment]);

	const isScrollable = days.length > WEEK_DAY_COUNT;
	const initialSpacing = 4;
	const endSpacing = 4;
	const spacingValue = isScrollable ? 4 : 6;
	const plotWidth = Math.max(220, chartWidth - Y_AXIS_LABEL_WIDTH - CHART_RIGHT_GUTTER);
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
	const labelWidth = isScrollable ? 44 : Math.max(30, barWidth + spacingValue);
	const chartScale = useMemo(
		() => getIntegerCountScale(aggregatedDays.map((day) => day.totalCount)),
		[aggregatedDays],
	);
	const selectedDetail = selectedSegment
		? getSelectedDetail(aggregatedDays, selectedSegment)
		: null;
	const stackData = useMemo(
		() =>
			aggregatedDays.map<stackDataItem>((day) => ({
				labelComponent: () => (
					<AxisDateLabel
						date={day.date}
						labelWidth={labelWidth}
						labelXOffset={isScrollable ? -(labelWidth - barWidth) / 2 : 0}
						showLabel={day.shouldShowLabel}
						showYear={day.showYear}
					/>
				),
				stacks:
					day.segments.length > 0
						? day.segments.map((segment) => ({
								color: segment.color,
								onPress: () =>
									setSelectedSegment({
										date: day.date,
										kind,
										type: segment.type,
									}),
								value: segment.count,
							}))
						: [{ color: "rgba(0,0,0,0)", value: 0 }],
			})),
		[aggregatedDays, barWidth, isScrollable, kind, labelWidth],
	);

	return (
		<View style={styles.container}>
			<View style={globalStyles.rowBetween}>
				<View>
					<Text style={globalStyles.sectionTitleText}>{getChartTitle(kind)}</Text>
					<Text style={styles.subtitle}>Daily count by type</Text>
				</View>
				<View style={styles.legendRow}>
					{getTypeOrder(kind).map((type) => (
						<LegendDot
							key={type}
							color={getTypeColor(kind, type)}
							label={getTypeLabel(kind, type)}
						/>
					))}
				</View>
			</View>

			{aggregatedDays.every((day) => day.totalCount === 0) ? (
				<View style={styles.emptyState}>
					<Text style={globalStyles.bodyText}>No {kind} entries in this range yet.</Text>
				</View>
			) : (
				<>
					<View style={styles.chartWrapper} onLayout={handleChartLayout(setChartWidth)}>
						<BarChart
							barWidth={barWidth}
							disableScroll={!isScrollable}
							endSpacing={endSpacing}
							height={180}
							initialSpacing={initialSpacing}
							labelWidth={labelWidth}
							maxValue={chartScale.maxValue}
							nestedScrollEnabled
							noOfSections={chartScale.noOfSections}
							roundToDigits={0}
							rulesColor="#EEF0F5"
							rulesType="solid"
							scrollToEnd={true}
							showFractionalValues={false}
							showScrollIndicator={isScrollable}
							spacing={spacingValue}
							stackData={stackData}
							stepValue={chartScale.stepValue}
							key={isScrollable ? `${kind}-daily-scrollable` : `${kind}-daily-static`}
							width={plotWidth}
							xAxisColor="#D9DEE8"
							xAxisLabelsHeight={44}
							xAxisLabelsVerticalShift={8}
							xAxisThickness={1}
							yAxisColor="#D9DEE8"
							yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
							yAxisLabelTexts={chartScale.labels}
							yAxisTextStyle={styles.axisLabel}
						/>
					</View>

					{selectedDetail ? (
						<View style={styles.detailCard}>
							<View>
								<Text style={styles.detailDate}>{formatDisplayDate(selectedDetail.date)}</Text>
								<Text style={styles.detailTitle}>{selectedDetail.label}</Text>
							</View>
							<View style={styles.detailMeta}>
								<Text style={styles.detailText}>
									{selectedDetail.count} {selectedDetail.count === 1 ? "entry" : "entries"}
								</Text>
								<Text style={styles.detailText}>{selectedDetail.detail}</Text>
							</View>
						</View>
					) : null}
				</>
			)}
		</View>
	);
}

function buildAggregatedDays(days: RoutineStatsDay[], kind: RoutineKind, preferredVolumeUnit: PreferredVolumeUnit): AggregatedDay[] {
	return days.map((day, index) => {
		const matchingLogs = day.logs.filter((log) => log.kind === kind);
		const segments = getTypeOrder(kind)
			.map((type) => buildSegment(kind, type, matchingLogs, preferredVolumeUnit))
			.filter((segment): segment is AggregatedSegment => segment !== null);

		return {
			date: day.date,
			segments,
			shouldShowLabel: shouldShowDateLabel(index, days.length),
			showYear: index === 0 || day.date.slice(0, 4) !== days[index - 1]?.date.slice(0, 4),
			totalCount: segments.reduce((total, segment) => total + segment.count, 0),
		};
	});
}

function buildSegment(
	kind: RoutineKind,
	type: RoutineSubtype,
	logs: RoutinePatternLog[],
	preferredVolumeUnit: PreferredVolumeUnit
) {
	const typeLogs = logs.filter((log) => log.type === type);

	if (typeLogs.length === 0) {
		return null;
	}

	return {
		color: getTypeColor(kind, type),
		count: typeLogs.length,
		detail: formatSegmentDetail(kind, type, typeLogs, preferredVolumeUnit),
		type,
	};
}

function formatSegmentDetail(
	kind: RoutineKind,
	type: RoutineSubtype,
	logs: RoutinePatternLog[],
	preferredVolumeUnit: PreferredVolumeUnit = "ml",
) {
	if (kind === "meal") {
		const mealLogs = logs as MealPatternLog[];

		if (type === "breastfeed") {
			const totalMinutes = mealLogs.reduce(
				(total, log) => total + (log.durationMinutes ?? 0),
				0,
			);
			const formattedDuration = formatDuration(totalMinutes);
			return `${formattedDuration} total`;
		}

		if (type === "solid") {
			const totalServings = mealLogs.reduce((total, log) => total + (log.amountServings ?? 0), 0);
			const totalGrams = mealLogs.reduce((total, log) => total + (log.amountGrams ?? 0), 0);
			const details = [];

			if (totalServings > 0) details.push(`${formatCompactNumber(totalServings)} servings`);
			if (totalGrams > 0) details.push(`${Math.round(totalGrams)} g`);

			return details.length > 0 ? `${details.join(" + ")} total` : "No amount logged";
		}

		const totalMl = mealLogs.reduce((total, log) => total + (log.amountMl ?? 0), 0);
		const formattedVolume = formatVolume(totalMl, preferredVolumeUnit);
		return `${formattedVolume} ${preferredVolumeUnit} total`;
	}

	if (kind === "sleep") {
		const totalMinutes = (logs as SleepPatternLog[]).reduce(
			(total, log) => total + getSleepDurationMinutes(log),
			0,
		);
		const formattedDuration = formatDuration(totalMinutes);
		return `${formattedDuration} total`;
	}

	return;
}

function getSleepDurationMinutes(log: SleepPatternLog) {
	if (!log.endTime) {
		return 0;
	}

	const start = new Date(log.startTime).getTime();
	const end = new Date(log.endTime).getTime();

	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return 0;
	}

	return Math.round((end - start) / 60000);
}

function findLatestSegment(
	days: AggregatedDay[],
	kind: RoutineKind,
): SelectedSegment | null {
	for (let index = days.length - 1; index >= 0; index -= 1) {
		const day = days[index];
		const segment = day.segments[day.segments.length - 1];

		if (segment) {
			return {
				date: day.date,
				kind,
				type: segment.type,
			};
		}
	}

	return null;
}

function getSelectedDetail(days: AggregatedDay[], selected: SelectedSegment) {
	const day = days.find((candidate) => candidate.date === selected.date);
	const segment = day?.segments.find((candidate) => candidate.type === selected.type);

	if (!day || !segment) {
		return null;
	}

	return {
		count: segment.count,
		date: day.date,
		detail: segment.detail,
		label: getTypeLabel(selected.kind, selected.type),
	};
}

function getIntegerCountScale(values: number[]) {
	const maxCount = Math.max(1, ...values);
	const stepValue = chooseIntegerStep(maxCount);
	const noOfSections = Math.max(1, Math.ceil(maxCount / stepValue));
	const maxValue = noOfSections * stepValue;

	return {
		labels: Array.from({ length: noOfSections + 1 }, (_, index) =>
			String(index * stepValue),
		),
		maxValue,
		noOfSections,
		stepValue,
	};
}

function chooseIntegerStep(maxCount: number) {
	if (maxCount <= 4) return 1;
	if (maxCount <= 10) return 2;
	if (maxCount <= 20) return 5;
	return 10;
}

function getChartTitle(kind: RoutineKind) {
	if (kind === "meal") return "Meal Counts";
	if (kind === "diaper") return "Diaper Changes";
	return "Sleep Sessions";
}

function getTypeOrder(kind: RoutineKind): RoutineSubtype[] {
	if (kind === "meal") return ["breastfeed", "breastMilk", "formula", "solid"] satisfies MealType[];
	if (kind === "diaper") return ["wet", "dirty", "both", "dry"] satisfies DiaperType[];
	return ["nap", "nighttime"] satisfies SleepType[];
}

function getTypeColor(kind: RoutineKind, type: RoutineSubtype) {
	return (TYPE_COLORS[kind] as Record<string, string>)[type];
}

function getTypeLabel(kind: RoutineKind, type: RoutineSubtype) {
	return (TYPE_LABELS[kind] as Record<string, string>)[type];
}

function shouldShowDateLabel(index: number, dayCount: number) {
	if (index === 0 || index === dayCount - 1) return true;
	if (dayCount <= WEEK_DAY_COUNT) return index % 2 === 0;
	if (dayCount <= MONTH_DAY_COUNT) return index % 5 === 0;
	return index % 7 === 0;
}

function handleChartLayout(setChartWidth: (width: number) => void) {
	return (event: LayoutChangeEvent) => {
		const nextWidth = Math.floor(event.nativeEvent.layout.width);

		if (nextWidth > 0) {
			setChartWidth(nextWidth);
		}
	};
}

function formatShortDate(date: string) {
	const [, month, day] = date.split("-");

	return `${Number(month)}/${Number(day)}`;
}

function formatDisplayDate(date: string) {
	const [year, month, day] = date.split("-");

	return `${Number(month)}/${Number(day)}/${year}`;
}

function formatCompactNumber(value: number) {
	return value.toFixed(2).replace(/\.?0+$/, "");
}

function AxisDateLabel({
	date,
	labelWidth,
	labelXOffset,
	showLabel,
	showYear,
}: {
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
				{showLabel ? formatShortDate(date) : " "}
			</Text>
			<Text
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				numberOfLines={1}
				style={styles.axisYearText}
			>
				{showLabel && showYear ? date.slice(0, 4) : " "}
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
	chartWrapper: {
		overflow: "hidden",
	},
	container: {
		gap: spacing.md,
		marginTop: spacing.lg,
	},
	detailCard: {
		alignItems: "flex-start",
		backgroundColor: "#F7F8FC",
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.md,
		justifyContent: "space-between",
		padding: spacing.md,
	},
	detailDate: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	detailMeta: {
		alignItems: "flex-end",
		flexShrink: 1,
		gap: 2,
	},
	detailText: {
		...typography.caption,
		color: colors.light.textSecondary,
		textAlign: "right",
	},
	detailTitle: {
		...typography.itemTitle,
		color: colors.light.textPrimary,
		marginTop: 2,
	},
	emptyState: {
		alignItems: "center",
		minHeight: 120,
		justifyContent: "center",
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
});
