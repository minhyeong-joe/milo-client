import { useAppTheme , useAppPreferences } from "@/context/AppPreferencesContext";
import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import { type RoutineKind, routineConfig } from "@/data/homeData";
import {
    type DiaperAverage,
    type MealAverage,
    type RoutineStatsSummary,
    type SleepAverage,
} from "@/services/api/routine";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { formatDuration, formatVolume, getAveragePerActiveDay } from "@/utils/routineDisplay";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function AverageSummaryCard({
    title,
    kind,
    summary,
}: {
    title: string;
    kind: RoutineKind;
    summary: RoutineStatsSummary[RoutineKind];
}) {
	const { styles } = useThemeStyles();
    const { preferredVolumeUnit } = useAppPreferences();
    const primaryAverage = getPrimaryAverage(kind, summary);
    const details = getDetailItems(kind, summary, preferredVolumeUnit);

    return (
        <View style={styles.summaryRow}>
            <RoutineIcon size={56} kind={kind} />
            <View style={styles.summaryContent}>
                <View style={styles.titleColumn}>
                    <Text style={styles.summaryTitle}>{title}</Text>
                    <Text
                        style={[
                            styles.primaryAverage,
                            { color: routineConfig.quickActions[kind].accentColor },
                        ]}
                    >
                        {primaryAverage}
                    </Text>
                </View>
                <View style={styles.detailGrid}>
                    {details.length > 0 ? (
                        details.map((detail) => (
                            <View key={detail.label} style={styles.detailChip}>
                                <Text style={styles.detailLabel}>{detail.label}</Text>
                                {detail.values.map((value) => (
                                    <Text key={value} style={styles.detailValue}>{value}</Text>
                                ))}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyDetail}>No entries in this range</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

function getTypeLabel(kind: RoutineKind, type: string) {
	if (kind === "meal" && type in routineConfig.mealTypes) {
		return routineConfig.mealTypes[type as keyof typeof routineConfig.mealTypes];
	}

	if (kind === "diaper" && type in routineConfig.diaperTypes) {
		return routineConfig.diaperTypes[type as keyof typeof routineConfig.diaperTypes];
	}

	if (kind === "sleep" && type in routineConfig.sleepTypes) {
		return routineConfig.sleepTypes[type as keyof typeof routineConfig.sleepTypes];
	}

	return type;
}

function getPrimaryAverage(
    kind: RoutineKind,
    summary: RoutineStatsSummary[RoutineKind],
) {
    if (kind === "sleep") {
        return `${formatDuration((summary as SleepAverage).avgDurationMinutesPerActiveDay)} / day`;
    }

    const label = kind === "meal" ? "sessions" : "changes";
    return `${getAveragePerActiveDay(kind, summary).toFixed(1)} ${label} / day`;
}

function getDetailItems(
    kind: RoutineKind,
    summary: RoutineStatsSummary[RoutineKind],
    preferredVolumeUnit: "ml" | "oz" = "ml",
) {
    if (kind === "meal") {
        const mealSummary = summary as MealAverage;
        const details = [
            buildDetail(
                "Breastfeed",
                [
                    formatSessionsPerDay(mealSummary.byType.breastfeed.avgSessionsPerActiveDay),
                    mealSummary.byType.breastfeed.avgDurationMinutesPerActiveDay > 0
                        ? `${formatDuration(mealSummary.byType.breastfeed.avgDurationMinutesPerActiveDay)} / day`
                        : "",
                ],
            ),
            buildDetail(
                "Breast milk",
                [
                    formatSessionsPerDay(mealSummary.byType.breastMilk.avgSessionsPerActiveDay),
                    mealSummary.byType.breastMilk.avgAmountMlPerActiveDay > 0
                        ? `${formatVolume(mealSummary.byType.breastMilk.avgAmountMlPerActiveDay, preferredVolumeUnit)} / day`
                        : "",
                ],
            ),
            buildDetail(
                "Formula",
                [
                    formatSessionsPerDay(mealSummary.byType.formula.avgSessionsPerActiveDay),
                    mealSummary.byType.formula.avgAmountMlPerActiveDay > 0
                        ? `${formatVolume(mealSummary.byType.formula.avgAmountMlPerActiveDay, preferredVolumeUnit)} / day`
                        : "",
                ],
            ),
            buildDetail("Solid", formatSolidAverage(mealSummary)),
        ];

        return details.filter((detail): detail is DetailItem => detail !== null);
    }

    if (kind === "diaper") {
        const diaperSummary = summary as DiaperAverage;

        return Object.entries(diaperSummary.byType)
            .map(([type, detail]) =>
                buildDetail(
                    getTypeLabel(kind, type),
                    [
                        detail.avgChangesPerActiveDay > 0
                            ? `${detail.avgChangesPerActiveDay.toFixed(1)} changes / day`
                            : "",
                    ],
                ),
            )
            .filter((detail): detail is DetailItem => detail !== null);
    }

    const sleepSummary = summary as SleepAverage;

    return Object.entries(sleepSummary.byType)
        .map(([type, detail]) =>
            buildDetail(
                getTypeLabel(kind, type),
                [
                    formatSessionsPerDay(detail.avgSessionsPerActiveDay),
                    detail.avgDurationMinutesPerActiveDay > 0
                        ? `${formatDuration(detail.avgDurationMinutesPerActiveDay)} / day`
                        : "",
                ],
            ),
        )
        .filter((detail): detail is DetailItem => detail !== null);
}

type DetailItem = {
    label: string;
    values: string[];
};

function buildDetail(label: string, values: string[]): DetailItem | null {
    const visibleValues = values.filter(Boolean);

    if (visibleValues.length === 0) {
        return null;
    }

    return { label, values: visibleValues };
}

function formatSessionsPerDay(value: number) {
    return value > 0 ? `${value.toFixed(1)} sessions / day` : "";
}

function formatSolidAverage(summary: MealAverage) {
    const parts: string[] = [];
    const solid = summary.byType.solid;

    if (solid.avgSessionsPerActiveDay > 0) {
        parts.push(formatSessionsPerDay(solid.avgSessionsPerActiveDay));
    }

    if (solid.avgServingsPerActiveDay > 0) {
        parts.push(`${solid.avgServingsPerActiveDay.toFixed(2)} servings / day`);
    }

    if (solid.avgGramsPerActiveDay > 0) {
        parts.push(`${solid.avgGramsPerActiveDay.toFixed(0)} g / day`);
    }

    return parts;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
    detailChip: {
        backgroundColor: themeColors.secondary,
        borderColor: themeColors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 94,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    detailGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    detailLabel: {
        ...typography.caption,
        color: themeColors.textSecondary,
        fontSize: 11,
    },
    detailValue: {
        color: themeColors.textPrimary,
        fontSize: 12,
        fontWeight: "800",
        lineHeight: 17,
        marginTop: 1,
    },
    emptyDetail: {
        color: themeColors.textSecondary,
        fontSize: 12,
        fontWeight: "600",
        lineHeight: 17,
    },
    primaryAverage: {
        fontSize: 14,
        fontWeight: "800",
        lineHeight: 19,
    },
    summaryContent: {
        flex: 1,
    },
    summaryRow: {
        alignItems: "flex-start",
        borderColor: themeColors.border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.md,
    },
    summaryTitle: {
        color: themeColors.textPrimary,
        fontSize: 15,
        fontWeight: "800",
    },
    titleColumn: {
        gap: 2,
    },
});
}
