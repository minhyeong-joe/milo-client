import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { RoutineIcon } from "../routine/RoutineIcon";
import { type RoutineKind, routineConfig } from "@/data/homeData";
import {
	type DiaperAverage,
	type MealAverage,
	type RoutineStatsSummary,
	type SleepAverage,
} from "@/services/api/routine";
import { formatDuration, getAveragePerActiveDay } from "@/utils/routineDisplay";

export default function SummaryCardButton({
    kind = "meal",
    isSelected = false,
    setSelected = () => {},
    summary
}: {
    kind: RoutineKind;
    isSelected?: boolean;
    setSelected?: (selected: boolean) => void;
    summary: RoutineStatsSummary[RoutineKind];
}) {
    const avgPerActiveDay = getAveragePerActiveDay(kind, summary);
    const metric = getSnapshotMetric(kind, summary);
    
    return (
        <Pressable 
            style={[
                globalStyles.card,
                styles.container,
                isSelected && styles.containerSelected,
            ]}
            onPress={() => setSelected(!isSelected)}
        >
            <RoutineIcon kind={kind} size={44} />
            <View style={styles.summaryTextContainer}>
                <Text style={[globalStyles.mutedText, styles.kindLabel]}>
                    {routineConfig.quickActions[kind].label}
                </Text>
                <Text style={[globalStyles.labelText, styles.totalText]}>{metric.total}</Text>
                <Text style={[styles.averageText, { color: routineConfig.quickActions[kind].accentColor }]}>
                    {metric.average ?? `${avgPerActiveDay.toFixed(1)} / day`}
                </Text>
                <Text style={[globalStyles.mutedText, styles.daysText]}>
                    {summary.activeDays} {summary.activeDays === 1 ? "day" : "days"} logged
                </Text>
            </View>
        </Pressable>
    );
}

function getSnapshotMetric(
    kind: RoutineKind,
    summary: RoutineStatsSummary[RoutineKind],
) {
    if (kind === "meal") {
        const mealSummary = summary as MealAverage;

        return {
            average: `${mealSummary.avgSessionsPerActiveDay.toFixed(1)} / day`,
            total: `${mealSummary.totalSessions} total`,
        };
    }

    if (kind === "diaper") {
        const diaperSummary = summary as DiaperAverage;

        return {
            average: `${diaperSummary.avgChangesPerActiveDay.toFixed(1)} / day`,
            total: `${diaperSummary.totalChanges} total`,
        };
    }

    const sleepSummary = summary as SleepAverage;

    return {
        average: `${formatDuration(sleepSummary.avgDurationMinutesPerActiveDay)} / day`,
        total: `${formatDuration(sleepSummary.totalDurationMinutes)} total`,
    };
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        backgroundColor: colors.light.surface,
        borderRadius: 14,
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.md,
        flex: 1,
    },
    containerSelected: {
        borderColor: colors.light.primary,
        borderWidth: 1.5,
        backgroundColor: "#F7F3FF",
    },
    averageText: {
        fontSize: 12,
        fontWeight: "800",
        textAlign: "center",
    },
    daysText: {
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
    },
    kindLabel: {
        fontSize: 12,
        fontWeight: "800",
        textAlign: "center",
    },
    summaryTextContainer: {
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
    },
    totalText: {
        fontSize: 12,
        lineHeight: 24,
        textAlign: "center",
    }
});
