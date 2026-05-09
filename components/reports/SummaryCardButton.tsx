import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { RoutineIcon } from "../routine/RoutineIcon";
import { RoutineKind } from "@/data/homeData";
import {
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
    const sleepDuration =
        kind === "sleep"
            ? (summary as SleepAverage).avgDurationMinutesPerActiveDay
            : null;
    
    return (
        <Pressable 
            style={[globalStyles.card, styles.container, isSelected && { backgroundColor: colors.light.success }]}
            onPress={() => setSelected(!isSelected)}
        >
            <RoutineIcon kind={kind} size={50} />
            <View style={styles.summaryTextContainer}>
                <Text style={[globalStyles.labelText, styles.summaryText]}>{avgPerActiveDay.toFixed(2)} / day</Text>
                {kind === "sleep" ? (
                    <Text style={[globalStyles.mutedText, styles.summaryText]}>{formatDuration(sleepDuration ?? 0)}/day</Text>
                ): null}
                <Text style={[globalStyles.mutedText, styles.summaryText]}>({summary.activeDays} {summary.activeDays === 1 ? "day" : "days"} logged)</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        backgroundColor: colors.light.surface,
        borderRadius: spacing.sm,
        justifyContent: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.sm,
        flex: 1,
    },
    summaryTextContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    summaryText: {
        textAlign: "center",
    }
});
