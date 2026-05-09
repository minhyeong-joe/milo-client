import { View, Text, StyleSheet } from "react-native";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import { type RoutineKind, routineConfig } from "@/data/homeData";
import { type RoutineStatsSummary } from "@/services/api/routine";
import { colors } from "@/styles/globalStyles";
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

    return (
        <View style={styles.summaryRow}>
            <RoutineIcon size={64} kind={kind} />
            <View style={styles.summaryContent}>
                <View style={styles.summaryHeader}>
                    <Text style={styles.summaryTitle}>{title}</Text>
                    <Text style={styles.summarySubtitle}>Per Day</Text>
                </View>
                {Object.entries(summary.byType).map(([type, summaryDetail]) => {
                    const avgCountByType = getAveragePerActiveDay(kind, summaryDetail);
                    if (avgCountByType === 0) {
                        return;
                    }
                    const avgByType = getAverageByType(kind, type, summaryDetail, preferredVolumeUnit);
                    return (
                        <View key={type} style={styles.detailWrap}>
                            <Text style={styles.detailText}>
                                {getTypeLabel(kind, type)}: {avgByType}
                            </Text>
                        </View>
                    );
                })}
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

const getAverageByType = (
    kind: RoutineKind,
    type: string,
    summaryDetail: Record<string, number>,
    preferredVolumeUnit: "ml" | "oz" = "ml"
) => {
    // console.log(summaryDetail)
    if (kind === "meal") {
        if (type === "breastfeed") {
            return `${formatDuration(summaryDetail.avgDurationMinutesPerActiveDay)}`;
        }
        if (type === "breastMilk" || type === "formula") {
            return `${formatVolume(summaryDetail.avgAmountMlPerActiveDay, preferredVolumeUnit)}`;
        }
        const formattedServings = summaryDetail.avgServingsPerActiveDay? `${summaryDetail.avgServingsPerActiveDay.toFixed(1)} servings` : "";
        const formattedGrams = summaryDetail.avgGramsPerActiveDay? `${summaryDetail.avgGramsPerActiveDay.toFixed(2)}g` : "";
        const separator = formattedServings && formattedGrams ? " + " : "";
        return `${formattedServings}${separator}${formattedGrams}`;
    }
    if (kind === "diaper") {
        return `${summaryDetail.avgChangesPerActiveDay.toFixed(1)} changes`;
    }
    if (kind === "sleep") {
        return `${formatDuration(summaryDetail.avgDurationMinutesPerActiveDay)}`;
    }
}

const styles = StyleSheet.create({
    detailText: {
        color: colors.light.textSecondary,
        fontSize: 12,
        fontWeight: "600",
        lineHeight: 17,
    },
    detailWrap: {
        gap: 2,
        marginTop: 4,
    },
    summaryContent: {
        flex: 1,
    },
    summaryHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    summaryRow: {
        alignItems: "center",
        borderColor: colors.light.border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        gap: 12,
        padding: 12,
    },
    summaryTitle: {
        color: colors.light.textPrimary,
        fontSize: 15,
        fontWeight: "800",
    },
    summarySubtitle: {
        color: colors.light.textPrimary,
        fontSize: 13,
        fontWeight: "800",
    },
});
