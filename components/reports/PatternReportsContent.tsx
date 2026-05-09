import { useState } from "react";
import type { PatternRangeMode } from "@/app/(tabs)/reports";
import type { RoutineStatsResponse } from "@/services/api/routine";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import RoutineTimetableChart from "@/components/reports/RoutineTimetableChart";
import SummaryCardButton from "@/components/reports/SummaryCardButton";
import { RoutineKind } from "@/data/homeData";
import RoutineDailyStackedChart from "@/components/reports/RoutineDailyStackedChart";
import AverageSummaryCard from "@/components/reports/AverageSummaryCard";

export default function PatternReportsContent({
	canShiftNext,
	endDate,
	isRefreshing,
	onRefresh,
	onRangeModeChange,
	onShiftRange,
	rangeMode,
	startDate,
	stats,
}: {
	canShiftNext: boolean;
	endDate: string;
	isLoading: boolean;
	isRefreshing: boolean;
	onRefresh: () => Promise<void>;
	onRangeModeChange: (mode: PatternRangeMode) => void;
	onShiftRange: (direction: -1 | 1) => void;
	rangeMode: PatternRangeMode;
	selectedBaby: unknown;
	startDate: string;
	stats: RoutineStatsResponse;
}) {
	const [showMeal, setShowMeal] = useState(true);
	const [showDiaper, setShowDiaper] = useState(true);
	const [showSleep, setShowSleep] = useState(true);
	const [selectedRoutineKind, setSelectedRoutineKind] = useState<RoutineKind>("meal");

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
			<View style={styles.rangeHeader}>
				<View style={styles.rangeNavigator}>
					<Pressable
						accessibilityRole="button"
						style={styles.chevronButton}
						onPress={() => onShiftRange(-1)}
					>
						<Ionicons
							color={colors.light.textPrimary}
							name="chevron-back"
							size={20}
						/>
					</Pressable>
					<Text style={styles.rangeLabel}>{formatRangeLabel(startDate, endDate)}</Text>
					<Pressable
						accessibilityRole="button"
						disabled={!canShiftNext}
						style={[
							styles.chevronButton,
							!canShiftNext && styles.chevronButtonDisabled,
						]}
						onPress={() => onShiftRange(1)}
					>
						<Ionicons
							color={canShiftNext ? colors.light.textPrimary : colors.light.textSecondary}
							name="chevron-forward"
							size={20}
						/>
					</Pressable>
				</View>

				<View style={styles.rangeToggle}>
					<RangeButton
						isSelected={rangeMode === "week"}
						label="Week"
						onPress={() => onRangeModeChange("week")}
					/>
					<RangeButton
						isSelected={rangeMode === "month"}
						label="Month"
						onPress={() => onRangeModeChange("month")}
					/>
				</View>
			</View>

			<View style={globalStyles.card}>
				<View style={[globalStyles.rowCenter, styles.routineToggleButtonGroup]}>
					<Pressable
						onPress={() => setShowMeal((prev) => !prev)}
					>
						<RoutineIcon kind="meal" size={46} customStyle={!showMeal ? styles.disabledIcon : undefined} />
					</Pressable>
					<Pressable
						onPress={() => setShowDiaper((prev) => !prev)}
					>
						<RoutineIcon kind="diaper" size={46} customStyle={!showDiaper ? styles.disabledIcon : undefined} />
					</Pressable>
					<Pressable
						onPress={() => setShowSleep((prev) => !prev)}
					>
						<RoutineIcon kind="sleep" size={46} customStyle={!showSleep ? styles.disabledIcon : undefined} />
					</Pressable>
				</View>
				<RoutineTimetableChart
					days={stats.days}
					showDiaper={showDiaper}
					showMeal={showMeal}
					showSleep={showSleep}
				/>
			</View>

			<View style={globalStyles.card}>
				<View style={globalStyles.rowBetween}>
					<Text style={globalStyles.sectionTitleText}>
						Summary
					</Text>
				</View>
				<View style={styles.summaryCardButtonGroup}>
					<SummaryCardButton 
						kind="meal"
						isSelected={selectedRoutineKind === "meal"}
						setSelected={(selected) => selected && setSelectedRoutineKind("meal")}
						summary={stats.summary.meal}
					/>
					<SummaryCardButton 
						kind="diaper"
						isSelected={selectedRoutineKind === "diaper"}
						setSelected={(selected) => selected && setSelectedRoutineKind("diaper")}
						summary={stats.summary.diaper}
					/>
					<SummaryCardButton 
						kind="sleep"
						isSelected={selectedRoutineKind === "sleep"}
						setSelected={(selected) => selected && setSelectedRoutineKind("sleep")}
						summary={stats.summary.sleep}
					/>
				</View>
				<RoutineDailyStackedChart
					days={stats.days}
					kind={selectedRoutineKind}
				/>
				<View style={{marginTop: spacing.lg}}>
					<Text style={[globalStyles.sectionTitleText, {marginBottom: spacing.sm}]}>
						Averages per Logged Day
					</Text>
					<AverageSummaryCard
						title="Meals"
						kind="meal"
						summary={stats.summary.meal}
					/>
					<AverageSummaryCard
						title="Diaper"
						kind="diaper"
						summary={stats.summary.diaper}
					/>
					<AverageSummaryCard
						title="Sleep"
						kind="sleep"
						summary={stats.summary.sleep}
					/>
				</View>
			</View>

		</ScrollView>
	);
}

function RangeButton({
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
			style={[styles.rangeButton, isSelected && styles.rangeButtonSelected]}
			onPress={onPress}
		>
			<Text style={[styles.rangeButtonText, isSelected && styles.rangeButtonTextSelected]}>
				{label}
			</Text>
		</Pressable>
	);
}

function formatRangeLabel(startDate: string, endDate: string) {
	const start = parseDateKey(startDate);
	const end = parseDateKey(endDate);
	const startLabel = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(start);
	const endLabel = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
	}).format(end);

	return `${startLabel} - ${endLabel}`;
}

function parseDateKey(value: string) {
	const [year, month, day] = value.split("-").map(Number);

	return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
	chevronButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 32,
		justifyContent: "center",
		width: 32,
	},
	chevronButtonDisabled: {
		opacity: 0.35,
	},
	rangeButton: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		paddingVertical: spacing.xs,
	},
	rangeButtonSelected: {
		backgroundColor: colors.light.surface,
	},
	rangeButtonText: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	rangeButtonTextSelected: {
		color: colors.light.textPrimary,
	},
	rangeHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.md,
		justifyContent: "space-between",
		marginVertical: spacing.md,
	},
	rangeLabel: {
		...typography.label,
		color: colors.light.textPrimary,
		minWidth: 118,
		textAlign: "center",
	},
	rangeNavigator: {
		alignItems: "center",
		flexDirection: "row",
		flexShrink: 1,
		gap: spacing.xs,
	},
	rangeToggle: {
		backgroundColor: "#ECEEF5",
		borderRadius: 999,
		flexDirection: "row",
		gap: spacing.xs,
		padding: spacing.xs,
		width: 148,
	},
	routineToggleButtonGroup: { 
		justifyContent: "center", 
		gap: spacing.lg,
		marginBottom: spacing.sm
	},
	disabledIcon: {
		opacity: 0.35,
	},
	summaryCardButtonGroup: {
		flexDirection: "row",
		justifyContent: "center",
		gap: spacing.sm,
		marginTop: spacing.sm
	}
});
