import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { useBabySelection } from "@/context/BabySelectionContext";
import { type GrowthRecord } from "@/services/api/growth";
import GrowthChartCard from "./GrowthChartCard";

export default function GrowthReportsContent({
    isLoading,
    isRefreshing,
    lengthUnit,
    onRefresh,
    records,
    selectedBaby,
    weightUnit,
}: {
    isLoading: boolean;
    isRefreshing: boolean;
    lengthUnit: "cm" | "in";
    onRefresh: () => Promise<void>;
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
            contentContainerStyle={globalStyles.scrollContent}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    tintColor={colors.light.primary}
                    onRefresh={() => void onRefresh()}
                />
            }
            showsVerticalScrollIndicator={false}
        >
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
    loadingContainer: {
        alignItems: "center",
        flex: 1,
        gap: spacing.md,
        justifyContent: "center",
    },
});
