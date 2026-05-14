import { useEffect, useState, useMemo, type ReactNode } from "react";
import { View, Text, useWindowDimensions, StyleSheet } from "react-native";
import { type GrowthRecord } from "@/services/api/growth";
import { LineChart } from "react-native-gifted-charts";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import {
	formatGrowthValue,
	getAgeInDays,
	getWhoReference,
	type GrowthMetric,
} from "@/utils/growthReports";
import { formatBabyAge } from "@/utils/routineDisplay";

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

export default function GrowthChartCard({
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
        () => buildChartPoints(records, metric, birthdate, sex),
        [birthdate, metric, records, sex],
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
        value: toChartUnitValue(point.value, metric, lengthUnit, weightUnit),
    }));
    const whoLineData = chartPoints.map<LineDataItem>((point) => ({
        hideDataPoint: true,
        value: toChartUnitValue(point.whoMedian ?? point.value, metric, lengthUnit, weightUnit),
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
                                <Text style={styles.pointDate}>{formatDisplayDate(selectedPoint.date)} - {formatBabyAgeWithString(birthdate, selectedPoint.date)} </Text>
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
    sex: "BOY" | "GIRL"
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
                value: measuredValue,
                whoMedian:
                    whoReference === null
                        ? null
                        : whoReference.median,
            };
        })
        .filter((point): point is ChartPoint => point !== null);
}

function toChartUnitValue(
    value: number,
    metric: GrowthMetric,
    lengthUnit: "cm" | "in",
    weightUnit: "kg" | "lb",
) {
    if (metric === "weight") {
        return weightUnit === "kg" ? value : value * 2.2046226218;
    }

    return lengthUnit === "cm" ? value : value / 2.54;
}


function formatShortDate(date: string) {
    const [, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
}

function formatDisplayDate(date: string) {
    const [year, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}/${year}`;
}

function formatBabyAgeWithString(birthdate: string, date: string) {
    const [year, month, day] = date.split("-").map(Number);
	const entryDate = new Date(year, month - 1, day);
    return formatBabyAge(birthdate, entryDate);
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
