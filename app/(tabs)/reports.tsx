import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { getGrowthRecords, type GrowthRecord } from "@/services/api/growth";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import {
	formatGrowthValue,
	getAgeInDays,
	getWhoReference,
	toDisplayGrowthValue,
	type GrowthMetric,
} from "@/utils/growthReports";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";

type ReportsTab = "growth" | "patterns";

type ChartPoint = {
	ageDays: number;
	date: string;
	id: string;
	measuredValue: number;
	percentile: number | null;
	value: number;
	whoMedian: number | null;
};

type LineDataItem = {
	dataPointColor?: string;
	dataPointRadius?: number;
	hideDataPoint?: boolean;
	label?: string;
	labelComponent?: () => ReactNode;
	onPress?: () => void;
	value: number;
};

const METRIC_CONFIG: Record<
	GrowthMetric,
	{ emptyText: string; label: string; sourceField: keyof GrowthRecord }
> = {
	head: {
		emptyText: "No head-size measurements yet.",
		label: "Head Size",
		sourceField: "headCircumferenceMm",
	},
	height: {
		emptyText: "No height measurements yet.",
		label: "Height",
		sourceField: "heightMm",
	},
	weight: {
		emptyText: "No weight measurements yet.",
		label: "Weight",
		sourceField: "weightGrams",
	},
};

export default function ReportsScreen() {
	const { refreshBabies, selectedBaby } = useBabySelection();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();
	const [activeTab, setActiveTab] = useState<ReportsTab>("growth");
	const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadGrowthRecords = useCallback(async () => {
		if (!selectedBaby) {
			setGrowthRecords([]);
			setError(null);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await getGrowthRecords(selectedBaby.id);
			setGrowthRecords(response.growthRecords);
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setIsLoading(false);
		}
	}, [selectedBaby]);

	const refreshReports = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await refreshBabies();
			await loadGrowthRecords();
		} finally {
			setIsRefreshing(false);
		}
	}, [loadGrowthRecords, refreshBabies]);

	useEffect(() => {
		void loadGrowthRecords();
	}, [loadGrowthRecords]);

	const sortedGrowthRecords = useMemo(
		() =>
			[...growthRecords].sort((left, right) =>
				left.measuredDate.localeCompare(right.measuredDate),
			),
		[growthRecords],
	);

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				<Text style={globalStyles.titleText}>Reports</Text>

				<View style={styles.segmentedControl}>
					<TabButton
						isSelected={activeTab === "growth"}
						label="Growth"
						onPress={() => setActiveTab("growth")}
					/>
					<TabButton
						isSelected={activeTab === "patterns"}
						label="Patterns"
						onPress={() => setActiveTab("patterns")}
					/>
				</View>

				{activeTab === "growth" ? (
					<GrowthReportsContent
						error={error}
						isLoading={isLoading}
						isRefreshing={isRefreshing}
						lengthUnit={preferredLengthUnit}
						onRetry={loadGrowthRecords}
						onRefresh={refreshReports}
						records={sortedGrowthRecords}
						selectedBaby={selectedBaby}
						weightUnit={preferredWeightUnit}
					/>
				) : (
					<View style={[globalStyles.card, styles.placeholderCard]}>
						<Text style={styles.placeholderTitle}>Patterns</Text>
						<Text style={globalStyles.bodyText}>
							Routine averages, trends, and time-of-day patterns will live here.
						</Text>
					</View>
				)}
			</View>
		</SafeAreaView>
	);
}

function GrowthReportsContent({
	error,
	isLoading,
	isRefreshing,
	lengthUnit,
	onRefresh,
	onRetry,
	records,
	selectedBaby,
	weightUnit,
}: {
	error: string | null;
	isLoading: boolean;
	isRefreshing: boolean;
	lengthUnit: "cm" | "in";
	onRefresh: () => Promise<void>;
	onRetry: () => Promise<void>;
	records: GrowthRecord[];
	selectedBaby: ReturnType<typeof useBabySelection>["selectedBaby"];
	weightUnit: "kg" | "lb";
}) {
	if (!selectedBaby) {
		return (
			<View style={[globalStyles.card, styles.placeholderCard]}>
				<Text style={styles.placeholderTitle}>No Baby Selected</Text>
				<Text style={globalStyles.bodyText}>
					Choose or create a baby profile to see growth reports.
				</Text>
			</View>
		);
	}

	if (isLoading && records.length === 0) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator color={colors.light.primary} />
				<Text style={globalStyles.bodyText}>Loading growth records...</Text>
			</View>
		);
	}

	return (
		<ScrollView
			contentContainerStyle={styles.scrollContent}
			refreshControl={
				<RefreshControl
					refreshing={isRefreshing}
					tintColor={colors.light.primary}
					onRefresh={() => void onRefresh()}
				/>
			}
			showsVerticalScrollIndicator={false}
		>
			{error ? (
				<View style={[globalStyles.card, styles.errorCard]}>
					<Text style={styles.errorText}>{error}</Text>
					<Pressable style={styles.retryButton} onPress={() => void onRetry()}>
						<Text style={styles.retryButtonText}>Try Again</Text>
					</Pressable>
				</View>
			) : null}

			<GrowthChartCard
				birthdate={selectedBaby.birthdate}
				lengthUnit={lengthUnit}
				metric="weight"
				records={records}
				sex={selectedBaby.sex}
				weightUnit={weightUnit}
			/>
			<GrowthChartCard
				birthdate={selectedBaby.birthdate}
				lengthUnit={lengthUnit}
				metric="height"
				records={records}
				sex={selectedBaby.sex}
				weightUnit={weightUnit}
			/>
			<GrowthChartCard
				birthdate={selectedBaby.birthdate}
				lengthUnit={lengthUnit}
				metric="head"
				records={records}
				sex={selectedBaby.sex}
				weightUnit={weightUnit}
			/>
		</ScrollView>
	);
}

function GrowthChartCard({
	birthdate,
	lengthUnit,
	metric,
	records,
	sex,
	weightUnit,
}: {
	birthdate: string;
	lengthUnit: "cm" | "in";
	metric: GrowthMetric;
	records: GrowthRecord[];
	sex: "BOY" | "GIRL";
	weightUnit: "kg" | "lb";
}) {
	const { width } = useWindowDimensions();
	const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
	const metricConfig = METRIC_CONFIG[metric];
	const units = useMemo(
		() => ({ length: lengthUnit, weight: weightUnit }),
		[lengthUnit, weightUnit],
	);
	const chartPoints = useMemo(
		() => buildChartPoints(records, metric, birthdate, sex, units),
		[birthdate, metric, records, sex, units],
	);
	const selectedPoint =
		chartPoints.find((point) => point.id === selectedPointId) ??
		chartPoints[chartPoints.length - 1] ??
		null;

	useEffect(() => {
		setSelectedPointId(null);
	}, [birthdate, metric, records, sex, lengthUnit, weightUnit]);

	const lineData = chartPoints.map<LineDataItem>((point, index) => ({
		dataPointColor:
			point.id === selectedPoint?.id ? colors.light.primary : "#35A1A4",
		dataPointRadius: point.id === selectedPoint?.id ? 6 : 4,
		labelComponent: () => (
			<AxisDateLabel
				date={point.date}
				showYear={shouldShowYear(chartPoints, index)}
			/>
		),
		onPress: () => setSelectedPointId(point.id),
		value: point.value,
	}));
	const whoLineData = chartPoints.map<LineDataItem>((point) => ({
		hideDataPoint: true,
		value: point.whoMedian ?? point.value,
	}));
	const chartValues = [...lineData, ...whoLineData].map((point) => point.value);
	const minValue = Math.min(...chartValues);
	const maxValue = Math.max(...chartValues);
	const yAxisOffset = Math.max(0, minValue - (maxValue - minValue || maxValue || 1) * 0.12);
	const maxChartValue = Math.max(1, maxValue - yAxisOffset + (maxValue - minValue || maxValue || 1) * 0.16);
	const chartWidth = Math.max(260, width - spacing.md * 4 - 46);
	const chartSpacing =
		chartPoints.length <= 1
			? 96
			: Math.max(72, Math.min(96, chartWidth / Math.max(1, chartPoints.length - 1)));
	const isChartScrollable = chartPoints.length >= 5;

	return (
		<View style={[globalStyles.card, styles.chartCard]}>
			<View style={globalStyles.rowBetween}>
				<View>
					<Text style={styles.chartTitle}>{metricConfig.label}</Text>
					<View style={styles.legendRow}>
						<View style={styles.legendDash}>
							<View style={styles.legendDashSegment} />
							<View style={styles.legendDashSegment} />
						</View>
						<Text style={styles.chartSubtitle}>WHO average</Text>
					</View>
				</View>
				<Text style={styles.unitLabel}>
					{metric === "weight" ? weightUnit : lengthUnit}
				</Text>
			</View>

			{chartPoints.length === 0 ? (
				<View style={styles.emptyMetricState}>
					<Text style={globalStyles.bodyText}>{metricConfig.emptyText}</Text>
				</View>
			) : (
				<>
					<View style={styles.chartWrapper}>
						<LineChart
							areaChart={false}
							color="#35A1A4"
							color2="#9CA3AF"
							curved
							data={lineData}
							data2={whoLineData}
							dataPointsColor="#35A1A4"
							disableScroll={chartPoints.length < 6}
							endSpacing={20}
							focusEnabled
							focusProximity={1000}
							hideDataPoints2
							height={180}
							initialSpacing={12}
							isAnimated
							maxValue={maxChartValue}
							noOfSections={4}
							pointerConfig={{
								activatePointersInstantlyOnTouch: true,
								hidePointer1: true,
								hidePointer2: true,
								persistPointer: true,
								pointerColor: "transparent",
								pointerLabelComponent: (
									_items: unknown,
									_secondaryItem: unknown,
									pointerIndex: number,
								) => {
									const point = chartPoints[pointerIndex];
									if (point && point.id !== selectedPointId) {
										setTimeout(() => setSelectedPointId(point.id), 0);
									}

									return null;
								},
								pointerLabelHeight: 0,
								pointerLabelWidth: 0,
								pointerStripColor: "transparent",
								pointerStripWidth: 0,
								resetPointerIndexOnRelease: false,
							}}
							roundToDigits={1}
							rulesColor="#EEF0F5"
							rulesType="solid"
							scrollToEnd={isChartScrollable}
							showFractionalValues
							spacing={chartSpacing}
							strokeDashArray2={[6, 6]}
							thickness={3}
							thickness2={2}
							width={chartWidth}
							xAxisColor="#D9DEE8"
							xAxisLabelsHeight={36}
							xAxisLabelTextStyle={styles.axisLabel}
							xAxisTextNumberOfLines={2}
							xAxisThickness={1}
							yAxisColor="#D9DEE8"
							yAxisLabelWidth={42}
							yAxisOffset={yAxisOffset}
							yAxisTextStyle={styles.axisLabel}
						/>
					</View>

					{selectedPoint ? (
						<View style={styles.pointDetail}>
							<View>
								<Text style={styles.pointDate}>{formatDisplayDate(selectedPoint.date)}</Text>
								<Text style={styles.pointValue}>
									{formatGrowthValue(metric, selectedPoint.measuredValue, units)}
								</Text>
							</View>
							<View style={styles.pointReference}>
								<Text style={styles.referenceText}>
									WHO percentile:{" "}
									{selectedPoint.percentile === null
										? "N/A"
										: `${Math.round(selectedPoint.percentile)}%`}
								</Text>
								<Text style={styles.referenceText}>
									WHO average:{" "}
									{selectedPoint.whoMedian === null
										? "N/A"
										: formatGrowthValue(metric, selectedPoint.whoMedian, units)}
								</Text>
							</View>
						</View>
					) : null}
				</>
			)}
		</View>
	);
}

function buildChartPoints(
	records: GrowthRecord[],
	metric: GrowthMetric,
	birthdate: string,
	sex: "BOY" | "GIRL",
	units: { length: "cm" | "in"; weight: "kg" | "lb" },
) {
	const sourceField = METRIC_CONFIG[metric].sourceField;

	return records
		.map((record): ChartPoint | null => {
			const rawValue = record[sourceField];

			if (typeof rawValue !== "number") {
				return null;
			}

			const measuredValue = metric === "weight" ? rawValue / 1000 : rawValue / 10;
			const ageDays = getAgeInDays(birthdate, record.measuredDate);

			if (ageDays === null) {
				return null;
			}

			const whoReference = getWhoReference(metric, sex, ageDays, measuredValue);

			return {
				ageDays,
				date: record.measuredDate,
				id: record.id,
				measuredValue,
				percentile: whoReference?.percentile ?? null,
				value: toDisplayGrowthValue(metric, measuredValue, units),
				whoMedian:
					whoReference === null
						? null
						: toDisplayGrowthValue(metric, whoReference.median, units),
			};
		})
		.filter((point): point is ChartPoint => point !== null);
}

function TabButton({
	isSelected,
	label,
	onPress,
}: {
	isSelected: boolean;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			style={[styles.tabButton, isSelected && styles.tabButtonSelected]}
			onPress={onPress}
		>
			<Text style={[styles.tabButtonText, isSelected && styles.tabButtonTextSelected]}>
				{label}
			</Text>
		</Pressable>
	);
}

function formatShortDate(date: string) {
	const [, month, day] = date.split("-");
	return `${Number(month)}/${Number(day)}`;
}

function formatDisplayDate(date: string) {
	const [year, month, day] = date.split("-");
	return `${Number(month)}/${Number(day)}/${year}`;
}

function shouldShowYear(points: ChartPoint[], index: number) {
	if (index === 0) {
		return true;
	}

	return points[index].date.slice(0, 4) !== points[index - 1].date.slice(0, 4);
}

function AxisDateLabel({
	date,
	showYear,
}: {
	date: string;
	showYear: boolean;
}) {
	return (
		<View style={styles.axisDateLabel}>
			<Text style={styles.axisDateText}>{formatShortDate(date)}</Text>
			<Text style={styles.axisYearText}>{showYear ? date.slice(0, 4) : " "}</Text>
		</View>
	);
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not load growth records.";
}

const styles = StyleSheet.create({
	axisLabel: {
		color: colors.light.textSecondary,
		fontSize: 10,
	},
	axisDateLabel: {
		alignItems: "center",
		minWidth: 48,
	},
	axisDateText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontSize: 10,
		lineHeight: 12,
		textAlign: "center",
	},
	axisYearText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontSize: 9,
		lineHeight: 11,
		textAlign: "center",
	},
	chartCard: {
		borderRadius: 14,
		gap: spacing.md,
		paddingBottom: spacing.lg,
	},
	chartSubtitle: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	chartTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	chartWrapper: {
		marginLeft: -spacing.sm,
		overflow: "hidden",
	},
	emptyMetricState: {
		alignItems: "center",
		minHeight: 120,
		justifyContent: "center",
	},
	errorCard: {
		borderColor: "#FECACA",
		gap: spacing.md,
	},
	errorText: {
		...typography.body,
		color: colors.light.error,
	},
	legendDash: {
		alignItems: "center",
		flexDirection: "row",
		gap: 3,
	},
	legendDashSegment: {
		backgroundColor: "#9CA3AF",
		borderRadius: 999,
		height: 2,
		width: 8,
	},
	legendRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.xs,
		marginTop: 4,
	},
	loadingContainer: {
		alignItems: "center",
		flex: 1,
		gap: spacing.md,
		justifyContent: "center",
	},
	placeholderCard: {
		gap: spacing.sm,
		marginTop: spacing.lg,
	},
	placeholderTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	pointDate: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	pointDetail: {
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
	pointReference: {
		alignItems: "flex-end",
		flexShrink: 1,
		gap: 2,
	},
	pointValue: {
		...typography.itemTitle,
		color: colors.light.textPrimary,
		marginTop: 2,
	},
	referenceText: {
		...typography.caption,
		color: colors.light.textSecondary,
		textAlign: "right",
	},
	retryButton: {
		alignSelf: "flex-start",
		backgroundColor: colors.light.primary,
		borderRadius: 10,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	retryButtonText: {
		...typography.caption,
		color: colors.light.surface,
	},
	scrollContent: {
		gap: spacing.md,
		paddingBottom: spacing.md,
		paddingTop: spacing.md,
	},
	segmentedControl: {
		backgroundColor: "#ECEEF5",
		borderRadius: 14,
		flexDirection: "row",
		gap: spacing.xs,
		marginTop: spacing.lg,
		padding: spacing.xs,
	},
	tabButton: {
		alignItems: "center",
		borderRadius: 10,
		flex: 1,
		paddingVertical: spacing.sm,
	},
	tabButtonSelected: {
		backgroundColor: colors.light.surface,
	},
	tabButtonText: {
		...typography.label,
		color: colors.light.textSecondary,
	},
	tabButtonTextSelected: {
		color: colors.light.textPrimary,
	},
	unitLabel: {
		...typography.caption,
		backgroundColor: "#F1EFFD",
		borderRadius: 999,
		color: colors.light.primary,
		overflow: "hidden",
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
});
