import { useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { type GrowthRecord } from "@/services/api/growth";
import GrowthChartCard from "./GrowthChartCard";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

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
    const router = useRouter();
    const { globalStyles, themeColors, styles } = useThemeStyles();

    if (!selectedBaby) {
        return (
            <View style={globalStyles.card}>
                <Text style={globalStyles.bodyText}>No Baby Selected</Text>
                <Text style={globalStyles.mutedText}>
                    Choose or create a baby profile to see growth reports.
                </Text>
            </View>
        );
    }

    if (isLoading && records.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={themeColors.primary} />
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
                    tintColor={themeColors.primary}
                    onRefresh={() => void onRefresh()}
                />
            }
            showsVerticalScrollIndicator={false}
        >
            <Pressable
                accessibilityRole="button"
                onPress={() => {
                    router.push("/baby/growth");
                }}
                style={styles.profileActionButton}
            >
                <Text style={styles.profileActionText}>
                    <Ionicons name="analytics-outline" size={20} />
                    {" "} Growth Measurements
                </Text>
            </Pressable>
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

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
    loadingContainer: {
        alignItems: "center",
        flex: 1,
        gap: spacing.md,
        justifyContent: "center",
    },
	profileActionButton: {
		alignItems: "center",
		backgroundColor: themeColors.primary,
		borderRadius: 12,
		paddingVertical: 14,
		width: "100%",
        marginTop: spacing.md,
	},
	profileActionText: {
		color: themeColors.surface,
		fontSize: 15,
		fontWeight: "800",
	},
});
}
