import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { BarChart, type stackDataItem } from "react-native-gifted-charts";
import type { DiaperType, MealType, RoutineKind, SleepType } from "@/data/homeData";
import type { RoutineStatsDay } from "@/services/api/routine";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppPreferences, useAppTheme } from "@/context/AppPreferencesContext";
import {
	buildDiaperSnapshotChartData,
	buildMealSnapshotChartData,
	buildSleepSnapshotChartData,
	DIAPER_TYPES,
	getDefaultMealMetric,
	getDefaultMealType,
	getMealMetricOptions,
	getTypeColor,
	getTypeLabel,
	MEAL_TYPES,
	METRIC_LABELS,
	type MealSnapshotMetric,
	type SleepSnapshotMetric,
	type SnapshotChartData,
	type SnapshotMetric,
	type SnapshotSubtype,
	SLEEP_TYPES,
} from "@/utils/routineSnapshotChartData";
import { formatDuration, formatVolume } from "@/utils/routineDisplay";

const DEFAULT_CHART_WIDTH = 300;
const Y_AXIS_LABEL_WIDTH = 42;
const CHART_RIGHT_GUTTER = 8;
const WEEK_DAY_COUNT = 7;
const MONTH_DAY_COUNT = 30;
const TRANSPARENT = "rgba(0,0,0,0)";

type SelectedStack = {
	date: string;
	type: SnapshotSubtype;
	value: number;
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function RoutineDailyStackedChart({
	days,
	kind,
	timeZone,
}: {
	days: RoutineStatsDay[];
	kind: RoutineKind;
	timeZone?: string;
}) {
	const { globalStyles, styles } = useThemeStyles();
	const { preferredVolumeUnit } = useAppPreferences();
	const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
	const [mealType, setMealType] = useState<MealType>(() => getDefaultMealType(days));
	const [mealMetric, setMealMetric] = useState<MealSnapshotMetric>(() =>
		getDefaultMealMetric(getDefaultMealType(days)),
	);
	const [enabledDiaperTypes, setEnabledDiaperTypes] = useState<DiaperType[]>(DIAPER_TYPES);
	const [enabledSleepTypes, setEnabledSleepTypes] = useState<SleepType[]>(SLEEP_TYPES);
	const [sleepMetric, setSleepMetric] = useState<SleepSnapshotMetric>("duration");

	useEffect(() => {
		if (kind !== "meal") {
			return;
		}

		const nextType = getDefaultMealType(days);
		setMealType(nextType);
		setMealMetric(getDefaultMealMetric(nextType));
	}, [days, kind]);

	const chartData = useMemo(
		() => {
			if (kind === "meal") {
				return buildMealSnapshotChartData({
					days,
					metric: mealMetric,
					preferredVolumeUnit,
					type: mealType,
				});
			}

			if (kind === "diaper") {
				return buildDiaperSnapshotChartData({
					days,
					enabledTypes: enabledDiaperTypes,
				});
			}

			return buildSleepSnapshotChartData({
				days,
				enabledTypes: enabledSleepTypes,
				metric: sleepMetric,
				timeZone,
			});
		},
		[
			days,
			enabledDiaperTypes,
			enabledSleepTypes,
			kind,
			mealMetric,
			mealType,
			preferredVolumeUnit,
			sleepMetric,
			timeZone,
		],
	);

	return (
		<View style={styles.container}>
			<View style={globalStyles.rowBetween}>
				<View>
					<Text style={globalStyles.sectionTitleText}>{chartData.title}</Text>
					<Text style={styles.subtitle}>{chartData.subtitle}</Text>
				</View>
				<SnapshotLegend chartData={chartData} kind={kind} />
			</View>

			<SnapshotControls
				enabledDiaperTypes={enabledDiaperTypes}
				enabledSleepTypes={enabledSleepTypes}
				kind={kind}
				mealMetric={mealMetric}
				mealType={mealType}
				onDiaperTypesChange={setEnabledDiaperTypes}
				onMealMetricChange={setMealMetric}
				onMealTypeChange={(nextType) => {
					setMealType(nextType);
					setMealMetric(getDefaultMealMetric(nextType));
				}}
				onSleepMetricChange={setSleepMetric}
				onSleepTypesChange={setEnabledSleepTypes}
				sleepMetric={sleepMetric}
			/>

			{chartData.days.every((day) => day.totalValue === 0) ? (
				<View style={styles.emptyState}>
					<Text style={globalStyles.bodyText}>{chartData.emptyState}</Text>
				</View>
			) : (
				<SnapshotBarChart
					chartData={chartData}
					chartWidth={chartWidth}
					days={days}
					kind={kind}
					onLayout={handleChartLayout(setChartWidth)}
					preferredVolumeUnit={preferredVolumeUnit}
				/>
			)}
		</View>
	);
}

function SnapshotControls({
	enabledDiaperTypes,
	enabledSleepTypes,
	kind,
	mealMetric,
	mealType,
	onDiaperTypesChange,
	onMealMetricChange,
	onMealTypeChange,
	onSleepMetricChange,
	onSleepTypesChange,
	sleepMetric,
}: {
	enabledDiaperTypes: DiaperType[];
	enabledSleepTypes: SleepType[];
	kind: RoutineKind;
	mealMetric: MealSnapshotMetric;
	mealType: MealType;
	onDiaperTypesChange: (types: DiaperType[]) => void;
	onMealMetricChange: (metric: MealSnapshotMetric) => void;
	onMealTypeChange: (type: MealType) => void;
	onSleepMetricChange: (metric: SleepSnapshotMetric) => void;
	onSleepTypesChange: (types: SleepType[]) => void;
	sleepMetric: SleepSnapshotMetric;
}) {
	const { styles } = useThemeStyles();

	if (kind === "meal") {
		return (
			<View style={styles.controlContainer}>
				<ChipGroup
					items={MEAL_TYPES}
					isSelected={(type) => type === mealType}
					kind="meal"
					onPress={onMealTypeChange}
				/>
				<MetricSelector
					metrics={getMealMetricOptions(mealType)}
					onSelect={onMealMetricChange}
					selectedMetric={mealMetric}
				/>
			</View>
		);
	}

	if (kind === "diaper") {
		return (
			<View style={styles.controlContainer}>
				<ChipGroup
					items={DIAPER_TYPES}
					isSelected={(type) => enabledDiaperTypes.includes(type)}
					kind="diaper"
					onPress={(type) => {
						const nextTypes = toggleType(enabledDiaperTypes, type);
						if (nextTypes.length > 0) {
							onDiaperTypesChange(nextTypes);
						}
					}}
				/>
			</View>
		);
	}

	return (
		<View style={styles.controlContainer}>
			<ChipGroup
				items={SLEEP_TYPES}
				isSelected={(type) => enabledSleepTypes.includes(type)}
				kind="sleep"
				onPress={(type) => {
					const nextTypes = toggleType(enabledSleepTypes, type);
					if (nextTypes.length > 0) {
						onSleepTypesChange(nextTypes);
					}
				}}
			/>
			<MetricSelector
				metrics={["duration", "sessions"]}
				onSelect={onSleepMetricChange}
				selectedMetric={sleepMetric}
			/>
		</View>
	);
}

function ChipGroup<T extends SnapshotSubtype>({
	isSelected,
	items,
	kind,
	onPress,
}: {
	isSelected: (item: T) => boolean;
	items: T[];
	kind: RoutineKind;
	onPress: (item: T) => void;
}) {
	const { styles, themeColors } = useThemeStyles();

	return (
		<View style={styles.chipGroup}>
			{items.map((item) => {
				const selected = isSelected(item);

				return (
					<Pressable
						accessibilityRole="button"
						key={item}
						onPress={() => onPress(item)}
						style={[
							styles.chip,
							selected && {
								backgroundColor: withAlpha(getTypeColor(kind, item), 0.16),
								borderColor: getTypeColor(kind, item),
							},
						]}
					>
						<Text style={[
							styles.chipText,
							selected && { color: themeColors.textPrimary },
						]}>
							{getTypeLabel(kind, item)}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function MetricSelector<T extends Exclude<SnapshotMetric, "changes">>({
	metrics,
	onSelect,
	selectedMetric,
}: {
	metrics: T[];
	onSelect: (metric: T) => void;
	selectedMetric: T;
}) {
	const { styles } = useThemeStyles();

	return (
		<View style={styles.metricToggle}>
			{metrics.map((metric) => {
				const selected = metric === selectedMetric;

				return (
					<Pressable
						accessibilityRole="button"
						key={metric}
						onPress={() => onSelect(metric)}
						style={[styles.metricButton, selected && styles.metricButtonSelected]}
					>
						<Text style={[
							styles.metricText,
							selected && styles.metricTextSelected,
						]}>
							{METRIC_LABELS[metric]}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function SnapshotLegend({
	chartData,
	kind,
}: {
	chartData: SnapshotChartData;
	kind: RoutineKind;
}) {
	const { styles } = useThemeStyles();
	const visibleTypes = Array.from(
		new Set(chartData.days.flatMap((day) => day.segments.map((segment) => segment.type))),
	);

	if (visibleTypes.length === 0) {
		return null;
	}

	return (
		<View style={styles.legendRow}>
			{visibleTypes.map((type) => (
				<LegendDot
					color={getTypeColor(kind, type)}
					key={type}
					label={getTypeLabel(kind, type)}
				/>
			))}
		</View>
	);
}

function SnapshotBarChart({
	chartData,
	chartWidth,
	days,
	kind,
	onLayout,
	preferredVolumeUnit,
}: {
	chartData: SnapshotChartData;
	chartWidth: number;
	days: RoutineStatsDay[];
	kind: RoutineKind;
	onLayout: (event: LayoutChangeEvent) => void;
	preferredVolumeUnit: "ml" | "oz";
}) {
	const { styles } = useThemeStyles();
	const [selectedStack, setSelectedStack] = useState<SelectedStack | null>(null);
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
	const stackData = useMemo(
		() =>
			chartData.days.map<stackDataItem>((day, index) => ({
				labelComponent: () => (
					<AxisDateLabel
						date={day.date}
						labelWidth={labelWidth}
						labelXOffset={isScrollable ? -(labelWidth - barWidth) / 2 : 0}
						showLabel={shouldShowDateLabel(index, chartData.days.length)}
						showYear={index === 0 || day.date.slice(0, 4) !== chartData.days[index - 1]?.date.slice(0, 4)}
					/>
				),
				stacks:
					day.segments.length > 0
						? day.segments.map((segment) => ({
								color: segment.color,
								onPress: () =>
									setSelectedStack({
										date: day.date,
										type: segment.type,
										value: segment.value,
									}),
								value: segment.value,
							}))
						: [{ color: TRANSPARENT, value: 0 }],
			})),
		[barWidth, chartData.days, isScrollable, labelWidth],
	);

	useEffect(() => {
		setSelectedStack(null);
	}, [chartData]);

	return (
		<View style={styles.chartWrapper} onLayout={onLayout}>
			{selectedStack ? (
				<SnapshotTooltip
					chartData={chartData}
					kind={kind}
					preferredVolumeUnit={preferredVolumeUnit}
					selectedStack={selectedStack}
					onTooltipPress={() => setSelectedStack(null)}
				/>
			) : null}
			<BarChart
				barWidth={barWidth}
				disableScroll={!isScrollable}
				endSpacing={endSpacing}
				height={180}
				initialSpacing={initialSpacing}
				labelWidth={labelWidth}
				maxValue={chartData.yAxis.maxValue}
				nestedScrollEnabled
				noOfSections={chartData.yAxis.noOfSections}
				roundToDigits={chartData.yAxis.roundToDigits}
				rulesColor="#EEF0F5"
				rulesType="solid"
				scrollToEnd={true}
				showFractionalValues={chartData.yAxis.showFractionalValues}
				showScrollIndicator={isScrollable}
				spacing={spacingValue}
				stackData={stackData}
				stepValue={chartData.yAxis.stepValue}
				key={`${kind}-${chartData.metric}-${isScrollable ? "scrollable" : "static"}`}
				width={plotWidth}
				xAxisColor="#D9DEE8"
				xAxisLabelsHeight={44}
				xAxisLabelsVerticalShift={8}
				xAxisThickness={1}
				yAxisColor="#D9DEE8"
				yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
				yAxisLabelTexts={chartData.yAxis.labels}
				yAxisTextStyle={styles.axisLabel}
			/>
		</View>
	);
}

function SnapshotTooltip({
	chartData,
	kind,
	preferredVolumeUnit,
	selectedStack,
	onTooltipPress
}: {
	chartData: SnapshotChartData;
	kind: RoutineKind;
	preferredVolumeUnit: "ml" | "oz";
	selectedStack: SelectedStack;
	onTooltipPress: () => void;
}) {
	const { styles } = useThemeStyles();

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onTooltipPress}
			style={styles.tooltip}
		>
			<Text style={styles.tooltipText}>
				{formatShortDate(selectedStack.date)} - {getTypeLabel(kind, selectedStack.type)}
			</Text>
			<Text style={styles.tooltipValue}>
				{formatSnapshotValue(chartData.metric, selectedStack.value, preferredVolumeUnit)}
			</Text>
		</Pressable>
	);
}

function toggleType<T>(currentTypes: T[], type: T) {
	return currentTypes.includes(type)
		? currentTypes.filter((currentType) => currentType !== type)
		: [...currentTypes, type];
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

function formatSnapshotValue(
	metric: SnapshotMetric,
	value: number,
	preferredVolumeUnit: "ml" | "oz",
) {
	if (metric === "duration") {
		return formatDuration(Math.round(value));
	}

	if (metric === "volume") {
		return preferredVolumeUnit === "oz"
			? `${value.toFixed(1)} oz`
			: formatVolume(value, "ml");
	}

	if (metric === "grams") {
		return `${Math.round(value)} g`;
	}

	if (metric === "servings") {
		return `${formatCompactNumber(value)} ${value === 1 ? "serving" : "servings"}`;
	}

	const roundedValue = Math.round(value);
	const noun = metric === "changes"
		? roundedValue === 1 ? "change" : "changes"
		: roundedValue === 1 ? "session" : "sessions";

	return `${roundedValue} ${noun}`;
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
	const { styles } = useThemeStyles();
	return (
		<View style={styles.legendItem}>
			<View style={[styles.legendDot, { backgroundColor: color }]} />
			<Text style={styles.legendText}>{label}</Text>
		</View>
	);
}

function withAlpha(hexColor: string, alpha: number) {
	const normalized = hexColor.replace("#", "");
	const red = parseInt(normalized.slice(0, 2), 16);
	const green = parseInt(normalized.slice(2, 4), 16);
	const blue = parseInt(normalized.slice(4, 6), 16);

	return `rgba(${red},${green},${blue},${alpha})`;
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
		chip: {
			alignItems: "center",
			borderColor: themeColors.border,
			borderRadius: 999,
			borderWidth: 1,
			minHeight: 30,
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.xs,
		},
		chipGroup: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.xs,
		},
		chipText: {
			...typography.caption,
			color: themeColors.textSecondary,
		},
		container: {
			gap: spacing.md,
			marginTop: spacing.lg,
		},
		controlContainer: {
			gap: spacing.sm,
		},
		emptyState: {
			alignItems: "center",
			justifyContent: "center",
			minHeight: 120,
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
		metricButton: {
			alignItems: "center",
			borderRadius: 999,
			flex: 1,
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.xs,
		},
		metricButtonSelected: {
			backgroundColor: themeColors.surface,
		},
		metricText: {
			...typography.caption,
			color: themeColors.textSecondary,
			textAlign: "center",
		},
		metricTextSelected: {
			color: themeColors.textPrimary,
		},
		metricToggle: {
			backgroundColor: themeColors.border,
			borderRadius: 999,
			flexDirection: "row",
			gap: spacing.xs,
			padding: spacing.xs,
		},
		subtitle: {
			...typography.caption,
			color: themeColors.textSecondary,
			marginTop: 2,
		},
		tooltip: {
			alignSelf: "center",
			backgroundColor: themeColors.surface,
			borderColor: themeColors.border,
			borderRadius: 10,
			borderWidth: 1,
			elevation: 3,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			position: "absolute",
			shadowColor: themeColors.textPrimary,
			shadowOffset: { height: 4, width: 0 },
			shadowOpacity: 0.12,
			shadowRadius: 10,
			top: spacing.xs,
			zIndex: 2,
		},
		tooltipText: {
			...typography.caption,
			color: themeColors.textSecondary,
			textAlign: "center",
		},
		tooltipValue: {
			color: themeColors.textPrimary,
			fontSize: 13,
			fontWeight: "800",
			marginTop: 1,
			textAlign: "center",
		},
	});
}
