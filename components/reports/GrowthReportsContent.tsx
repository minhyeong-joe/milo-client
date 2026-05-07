import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from "react-native";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useBabySelection } from "@/context/BabySelectionContext";
import { type GrowthRecord } from "@/services/api/growth";
import GrowthChartCard from "./GrowthChartCard";

export default function GrowthReportsContent({
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
            <View style={[globalStyles.card, globalStyles.placeholderCard]}>
                <Text style={globalStyles.placeholderTitle}>No Baby Selected</Text>
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

const styles = StyleSheet.create({
    errorCard: {
        borderColor: "#FECACA",
        gap: spacing.md,
    },
    errorText: {
        ...typography.body,
        color: colors.light.error,
    },
    loadingContainer: {
        alignItems: "center",
        flex: 1,
        gap: spacing.md,
        justifyContent: "center",
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
    }
});