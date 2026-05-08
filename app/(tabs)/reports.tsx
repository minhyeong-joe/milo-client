import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { getGrowthRecords, type GrowthRecord } from "@/services/api/growth";
import { type RoutineStatsResponse } from "@/services/api/routine";
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
import PatternReportsContent from "@/components/reports/PatternReportsContent";

type ReportsTab = "growth" | "patterns";
export type PatternRangeMode = "week" | "month";

const PATTERN_RANGE_DAYS: Record<PatternRangeMode, number> = {
	month: 30,
	week: 7,
};

export default function ReportsScreen() {
	const { selectedBaby } = useBabySelection();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();
	const [activeTab, setActiveTab] = useState<ReportsTab>("growth");
	const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
	const [patternRangeMode, setPatternRangeMode] = useState<PatternRangeMode>("week");
	const [patternEndDate, setPatternEndDate] = useState<string | null>(null);
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

	// const refreshReports = useCallback(async () => {
	// 	setIsRefreshing(true);

	// 	try {
	// 		await refreshBabies();
	// 		await loadGrowthRecords();
	// 	} finally {
	// 		setIsRefreshing(false);
	// 	}
	// }, [loadGrowthRecords, refreshBabies]);

	const refreshGrowthRecords = useCallback(async () => {
		if (!selectedBaby) {
			return;
		}

		setIsRefreshing(true);

		try {
			await loadGrowthRecords();
		} finally {
			setIsRefreshing(false);
		}
	}, [loadGrowthRecords, selectedBaby]);

	const refreshLogStats = useCallback(async () => {
		if (!selectedBaby) {
			return;
		}

		setIsRefreshing(true);

		try {
			// await loadPatternRecords();
		} finally {
			setIsRefreshing(false);
		}
	}, [selectedBaby]);
	const shiftPatternRange = useCallback((direction: -1 | 1) => {
		if (!selectedBaby) {
			return;
		}

		const today = getDateKeyInTimeZone(new Date(), selectedBaby.timezone);
		const shiftDays = PATTERN_RANGE_DAYS[patternRangeMode] * direction;

		setPatternEndDate((current) => {
			const currentEndDate = current ?? today;
			const shiftedEndDate = addDays(currentEndDate, shiftDays);

			return direction > 0 && shiftedEndDate > today ? today : shiftedEndDate;
		});
	}, [patternRangeMode, selectedBaby]);

	useEffect(() => {
		void loadGrowthRecords();
	}, [loadGrowthRecords]);

	useEffect(() => {
		if (!selectedBaby) {
			setPatternEndDate(null);
			return;
		}

		setPatternEndDate(getDateKeyInTimeZone(new Date(), selectedBaby.timezone));
	}, [selectedBaby]);

	const sortedGrowthRecords = useMemo(
		() =>
			[...growthRecords].sort((left, right) =>
				left.measuredDate.localeCompare(right.measuredDate),
			),
		[growthRecords],
	);
	const patternDayCount = PATTERN_RANGE_DAYS[patternRangeMode];
	const patternEndDateKey =
		patternEndDate ??
		(selectedBaby
			? getDateKeyInTimeZone(new Date(), selectedBaby.timezone)
			: getDateKey(new Date()));
	const patternStartDate = addDays(patternEndDateKey, -(patternDayCount - 1));
	const patternStats = useMemo(
		() => createEmptyRoutineStats(patternStartDate, patternEndDateKey),
		[patternEndDateKey, patternStartDate],
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

				{error ? (
					<View style={[globalStyles.card, styles.errorCard]}>
						<Text style={styles.errorText}>{error}</Text>
						<Pressable style={styles.retryButton} onPress={() => void loadGrowthRecords()}>
							<Text style={styles.retryButtonText}>Try Again</Text>
						</Pressable>
					</View>
				) : null}

				{activeTab === "growth" ? (
					<GrowthReportsContent
						isLoading={isLoading}
						isRefreshing={isRefreshing}
						lengthUnit={preferredLengthUnit}
						onRefresh={refreshGrowthRecords}
						records={sortedGrowthRecords}
						selectedBaby={selectedBaby}
						weightUnit={preferredWeightUnit}
					/>
				) : (
					<PatternReportsContent
						canShiftNext={patternEndDateKey < (selectedBaby
							? getDateKeyInTimeZone(new Date(), selectedBaby.timezone)
							: getDateKey(new Date()))}
						endDate={patternEndDateKey}
						isLoading={isLoading}
						isRefreshing={isRefreshing}
						onRefresh={refreshLogStats}
						onRangeModeChange={setPatternRangeMode}
						onShiftRange={shiftPatternRange}
						rangeMode={patternRangeMode}
						selectedBaby={selectedBaby}
						startDate={patternStartDate}
						stats={patternStats}
					/>
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

function createEmptyRoutineStats(startDate: string, endDate: string): RoutineStatsResponse {
	const dayCount = getInclusiveDayCount(startDate, endDate);

	return {
		dayCount,
		days: Array.from({ length: dayCount }, (_, index) => ({
			date: addDays(startDate, index),
			logs: [],
		})),
		endDate,
		startDate,
		summary: {
			diaper: {
				both: { averageCount: 0 },
				dirty: { averageCount: 0 },
				dry: { averageCount: 0 },
				total: { averageCount: 0 },
				wet: { averageCount: 0 },
			},
			meal: {
				breastfeed: {
					averageCount: 0,
					averageDurationMinutes: null,
				},
				breastMilk: {
					averageAmountMl: null,
					averageCount: 0,
				},
				formula: {
					averageAmountMl: null,
					averageCount: 0,
				},
				solid: {
					averageAmountBowl: null,
					averageAmountGrams: null,
					averageCount: 0,
				},
				total: { averageCount: 0 },
			},
			sleep: {
				nap: {
					averageCount: 0,
					averageDurationMinutes: null,
				},
				nighttime: {
					averageCount: 0,
					averageDurationMinutes: null,
				},
				total: {
					averageCount: 0,
					averageDurationMinutes: null,
				},
			},
		},
	};
}

function getDateKeyInTimeZone(value: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(value);
	const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

	return `${byType.year}-${byType.month}-${byType.day}`;
}

function getDateKey(value: Date) {
	const year = value.getFullYear();
	const month = `${value.getMonth() + 1}`.padStart(2, "0");
	const day = `${value.getDate()}`.padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number) {
	const date = new Date(`${dateKey}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);

	return date.toISOString().slice(0, 10);
}

function getInclusiveDayCount(startDate: string, endDate: string) {
	const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
	const end = new Date(`${endDate}T00:00:00.000Z`).getTime();

	return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

const styles = StyleSheet.create({
	errorCard: {
		borderColor: "#FECACA",
		gap: spacing.md,
		marginTop: spacing.md,
	},
	errorText: {
		...typography.body,
		color: colors.light.error,
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
