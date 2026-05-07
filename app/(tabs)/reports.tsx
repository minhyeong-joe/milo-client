import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { getGrowthRecords, type GrowthRecord } from "@/services/api/growth";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GrowthReportsContent from "@/components/reports/GrowthReportsContent";

type ReportsTab = "growth" | "patterns";

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
					<View style={[globalStyles.card, globalStyles.placeholderCard]}>
						<Text style={globalStyles.placeholderTitle}>Patterns</Text>
						<Text style={globalStyles.bodyText}>
							Routine averages, trends, and time-of-day patterns will live here.
						</Text>
					</View>
				)}
			</View>
		</SafeAreaView>
	);
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

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not load growth records.";
}

const styles = StyleSheet.create({
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
	}
});
