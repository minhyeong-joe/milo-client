import { View, Text, StyleSheet } from "react-native";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import { type RoutineKind, routineConfig } from "@/data/homeData";
import {
    type DiaperAverage,
    type MealAverage,
    type RoutineStatsSummary,
    type SleepAverage,
} from "@/services/api/routine";
import { colors, spacing, typography } from "@/styles/globalStyles";
import { formatDuration, formatVolume, getAveragePerActiveDay } from "@/utils/routineDisplay";
import { useAppPreferences } from "@/context/AppPreferencesContext";

export default function AverageSummaryCard({
    title,
    kind,
    summary,
}: {
    title: string;
    kind: RoutineKind;
    summary: RoutineStatsSummary[RoutineKind];
}) {
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
                                <Text style={styles.detailValue}>{detail.value}</Text>
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
                mealSummary.byType.breastfeed.avgDurationMinutesPerActiveDay > 0
                    ? `${formatDuration(mealSummary.byType.breastfeed.avgDurationMinutesPerActiveDay)} / day`
                    : "",
            ),
            buildDetail(
                "Breast milk",
                mealSummary.byType.breastMilk.avgAmountMlPerActiveDay > 0
                    ? `${formatVolume(mealSummary.byType.breastMilk.avgAmountMlPerActiveDay, preferredVolumeUnit)} / day`
                    : "",
            ),
            buildDetail(
                "Formula",
                mealSummary.byType.formula.avgAmountMlPerActiveDay > 0
                    ? `${formatVolume(mealSummary.byType.formula.avgAmountMlPerActiveDay, preferredVolumeUnit)} / day`
                    : "",
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
                    detail.avgChangesPerActiveDay > 0
                        ? `${detail.avgChangesPerActiveDay.toFixed(1)} / day`
                        : "",
                ),
            )
            .filter((detail): detail is DetailItem => detail !== null);
    }

    const sleepSummary = summary as SleepAverage;

    return Object.entries(sleepSummary.byType)
        .map(([type, detail]) =>
            buildDetail(
                getTypeLabel(kind, type),
                detail.avgDurationMinutesPerActiveDay > 0
                    ? `${formatDuration(detail.avgDurationMinutesPerActiveDay)} / day`
                    : "",
            ),
        )
        .filter((detail): detail is DetailItem => detail !== null);
}

type DetailItem = {
    label: string;
    value: string;
};

function buildDetail(label: string, value: string): DetailItem | null {
    if (!value) {
        return null;
    }

    return { label, value };
}

function formatSolidAverage(summary: MealAverage) {
    const parts: string[] = [];
    const solid = summary.byType.solid;

    if (solid.avgServingsPerActiveDay > 0) {
        parts.push(`${solid.avgServingsPerActiveDay.toFixed(2)} servings`);
    }

    if (solid.avgGramsPerActiveDay > 0) {
        parts.push(`${solid.avgGramsPerActiveDay.toFixed(0)} g`);
    }

    return parts.join(" + ") + (parts.length > 0 ? " / day" : "");
}

const styles = StyleSheet.create({
    detailChip: {
        backgroundColor: "#F7F8FC",
        borderColor: colors.light.border,
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
        color: colors.light.textSecondary,
        fontSize: 11,
    },
    detailValue: {
        color: colors.light.textPrimary,
        fontSize: 12,
        fontWeight: "800",
        lineHeight: 17,
        marginTop: 1,
    },
    emptyDetail: {
        color: colors.light.textSecondary,
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
        borderColor: colors.light.border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.md,
    },
    summaryTitle: {
        color: colors.light.textPrimary,
        fontSize: 15,
        fontWeight: "800",
    },
    titleColumn: {
        gap: 2,
    },
});
