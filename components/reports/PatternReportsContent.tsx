import { useState, useMemo } from "react";
import type { PatternRangeMode } from "@/app/(tabs)/reports";
import type { RoutineStatsResponse } from "@/services/api/routine";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
	Modal,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import RoutineTimetableChart from "@/components/reports/RoutineTimetableChart";
import SummaryCardButton from "@/components/reports/SummaryCardButton";
import { RoutineKind } from "@/data/homeData";
import RoutineDailyStackedChart from "@/components/reports/RoutineDailyStackedChart";
import AverageSummaryCard from "@/components/reports/AverageSummaryCard";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function PatternReportsContent({
	canShiftNext,
	endDate,
	isRefreshing,
	maxDate,
	onCustomRangeApply,
	onRefresh,
	onRangeModeChange,
	onShiftRange,
	rangeMode,
	startDate,
	stats,
	timeZone,
}: {
	canShiftNext: boolean;
	endDate: string;
	isLoading: boolean;
	isRefreshing: boolean;
	maxDate: string;
	onCustomRangeApply: (startDate: string, endDate: string) => void;
	onRefresh: () => Promise<void>;
	onRangeModeChange: (mode: PatternRangeMode) => void;
	onShiftRange: (direction: -1 | 1) => void;
	rangeMode: PatternRangeMode;
	selectedBaby: unknown;
	startDate: string;
	stats: RoutineStatsResponse;
	timeZone?: string;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const [showMeal, setShowMeal] = useState(true);
	const [showDiaper, setShowDiaper] = useState(true);
	const [showSleep, setShowSleep] = useState(true);
	const [selectedRoutineKind, setSelectedRoutineKind] = useState<RoutineKind>("meal");
	const [isCustomRangeModalVisible, setIsCustomRangeModalVisible] = useState(false);
	const [draftStartDate, setDraftStartDate] = useState(() => parseDateKey(startDate));
	const [draftEndDate, setDraftEndDate] = useState(() => parseDateKey(endDate));
	const [activeDatePicker, setActiveDatePicker] = useState<"end" | "start" | null>(null);
	const isDraftRangeValid = getDateKey(draftStartDate) <= getDateKey(draftEndDate);

	const openCustomRangeModal = () => {
		setDraftStartDate(parseDateKey(startDate));
		setDraftEndDate(parseDateKey(endDate));
		setActiveDatePicker(null);
		setIsCustomRangeModalVisible(true);
	};

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
			<View style={styles.rangeHeader}>
				<View style={styles.rangeNavigator}>
					<Pressable
						accessibilityRole="button"
						style={styles.chevronButton}
						onPress={() => onShiftRange(-1)}
					>
						<Ionicons
							color={themeColors.textPrimary}
							name="chevron-back"
							size={20}
						/>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						style={styles.rangeLabelButton}
						onPress={openCustomRangeModal}
					>
						<Text style={styles.rangeLabel}>{formatRangeLabel(startDate, endDate, timeZone)}</Text>
						<Ionicons
							color={themeColors.textSecondary}
							name="calendar-outline"
							size={15}
						/>
					</Pressable>
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
							color={canShiftNext ? themeColors.textPrimary : themeColors.textSecondary}
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
					<View>
						<Text style={globalStyles.sectionTitleText}>
							{getSnapshotTitle(rangeMode)}
						</Text>
						<Text style={styles.summarySubtitle}>
							{formatRangeLabel(startDate, endDate, timeZone)} - Based on days with entries
						</Text>
					</View>
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
			</View>

			<View style={globalStyles.card}>
				<Text style={globalStyles.sectionTitleText}>
					Typical Logged Day
				</Text>
				<Text style={styles.summarySubtitle}>
					Averages based on days with entries
				</Text>
				<View style={styles.averageSummaryList}>
					<AverageSummaryCard
						title="Meals"
						kind="meal"
						summary={stats.summary.meal}
					/>
					<AverageSummaryCard
						title="Diapers"
						kind="diaper"
						summary={stats.summary.diaper}
					/>
					<AverageSummaryCard
						title="Sleep"
						kind="sleep"
						summary={stats.summary.sleep}
					/>
				</View>
				<View style={styles.footnoteRow}>
					<Ionicons
						color={themeColors.textSecondary}
						name="information-circle-outline"
						size={16}
					/>
					<Text style={styles.footnoteText}>
						Averages exclude days without any entries.
					</Text>
				</View>
			</View>

			<Modal
				animationType="fade"
				onRequestClose={() => setIsCustomRangeModalVisible(false)}
				transparent
				visible={isCustomRangeModalVisible}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<View style={globalStyles.rowBetween}>
							<Text style={globalStyles.sectionTitleText}>Choose date range</Text>
							<Pressable
								accessibilityRole="button"
								onPress={() => setIsCustomRangeModalVisible(false)}
							>
								<Ionicons
									color={themeColors.textSecondary}
									name="close"
									size={22}
								/>
							</Pressable>
						</View>
						<Text style={styles.modalSubtitle}>
							Choose inclusive dates for report.
						</Text>
						<DateField
							isActive={activeDatePicker === "start"}
							label="From"
							onPress={() => setActiveDatePicker((current) => current === "start" ? null : "start")}
							timeZone={timeZone}
							value={draftStartDate}
						/>
						<DateField
							isActive={activeDatePicker === "end"}
							label="To"
							onPress={() => setActiveDatePicker((current) => current === "end" ? null : "end")}
							timeZone={timeZone}
							value={draftEndDate}
						/>
						{activeDatePicker ? (
							<DateTimePicker
								display={Platform.OS === "ios" ? "spinner" : "default"}
								maximumDate={parseDateKey(maxDate)}
								mode="date"
								onChange={(event, selectedDate) =>
									handleDatePickerChange({
										event,
										maxDate,
										selectedDate,
										setActiveDatePicker,
										setDraftEndDate,
										setDraftStartDate,
										target: activeDatePicker,
									})
								}
								value={activeDatePicker === "start" ? draftStartDate : draftEndDate}
							/>
						) : null}
						{!isDraftRangeValid ? (
							<Text style={styles.validationText}>To date must be on or after From date.</Text>
						) : null}
						<View style={styles.modalActions}>
							<Pressable
								accessibilityRole="button"
								style={styles.cancelButton}
								onPress={() => setIsCustomRangeModalVisible(false)}
							>
								<Text style={styles.cancelButtonText}>Cancel</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								disabled={!isDraftRangeValid}
								style={[
									styles.applyButton,
									!isDraftRangeValid && styles.applyButtonDisabled,
								]}
								onPress={() => {
									onCustomRangeApply(getDateKey(draftStartDate), getDateKey(draftEndDate));
									setIsCustomRangeModalVisible(false);
									setActiveDatePicker(null);
								}}
							>
								<Text style={styles.applyButtonText}>Apply</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</ScrollView>
	);
}

function DateField({
	isActive,
	label,
	onPress,
	timeZone,
	value,
}: {
	isActive: boolean;
	label: string;
	onPress: () => void;
	timeZone?: string;
	value: Date;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<Pressable
			accessibilityRole="button"
			style={[styles.dateField, isActive && styles.dateFieldActive]}
			onPress={onPress}
		>
			<View>
				<Text style={styles.dateFieldLabel}>{label}</Text>
				<Text style={styles.dateFieldValue}>{formatFullDate(value, timeZone)}</Text>
			</View>
			<Ionicons
				color={themeColors.textSecondary}
				name="calendar-outline"
				size={20}
			/>
		</Pressable>
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
	const { styles } = useThemeStyles();
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

function getSnapshotTitle(rangeMode: PatternRangeMode) {
	if (rangeMode === "custom") return "Custom Date Snapshot";
	if (rangeMode === "month") return "Monthly Snapshot";
	return "Weekly Snapshot";
}

function formatRangeLabel(startDate: string, endDate: string, timeZone?: string) {
	const start = parseDateKey(startDate);
	const end = parseDateKey(endDate);
	const startLabel = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		timeZone,
	}).format(start);
	const endLabel = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		timeZone,
		year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
	}).format(end);

	return `${startLabel} - ${endLabel}`;
}

function formatFullDate(value: Date, timeZone?: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(value);
}

function parseDateKey(value: string) {
	const [year, month, day] = value.split("-").map(Number);

	return new Date(year, month - 1, day);
}

function getDateKey(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function handleDatePickerChange({
	event,
	maxDate,
	selectedDate,
	setActiveDatePicker,
	setDraftEndDate,
	setDraftStartDate,
	target,
}: {
	event: DateTimePickerEvent;
	maxDate: string;
	selectedDate?: Date;
	setActiveDatePicker: (value: "end" | "start" | null) => void;
	setDraftEndDate: (value: Date) => void;
	setDraftStartDate: (value: Date) => void;
	target: "end" | "start";
}) {
	if (Platform.OS === "android") {
		setActiveDatePicker(null);
	}

	if (event.type === "dismissed" || !selectedDate) {
		return;
	}

	const cappedDate = getDateKey(selectedDate) > maxDate
		? parseDateKey(maxDate)
		: selectedDate;

	if (target === "start") {
		setDraftStartDate(cappedDate);
	} else {
		setDraftEndDate(cappedDate);
	}
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	applyButton: {
		alignItems: "center",
		backgroundColor: themeColors.primary,
		borderRadius: 12,
		flex: 1,
		paddingVertical: spacing.md,
	},
	applyButtonDisabled: {
		opacity: 0.45,
	},
	applyButtonText: {
		color: themeColors.surface,
		fontSize: 15,
		fontWeight: "800",
	},
	averageSummaryList: {
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	cancelButton: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 12,
		borderWidth: 1,
		flex: 1,
		paddingVertical: spacing.md,
	},
	cancelButtonText: {
		color: themeColors.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
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
	dateField: {
		alignItems: "center",
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		padding: spacing.md,
	},
	dateFieldActive: {
		backgroundColor: "#F7F3FF",
		borderColor: themeColors.primary,
	},
	dateFieldLabel: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	dateFieldValue: {
		...typography.label,
		color: themeColors.textPrimary,
		marginTop: 2,
	},
	rangeButton: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		paddingVertical: spacing.xs,
	},
	rangeButtonSelected: {
		backgroundColor: themeColors.surface,
	},
	rangeButtonText: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	rangeButtonTextSelected: {
		color: themeColors.textPrimary,
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
		color: themeColors.textPrimary,
		textAlign: "center",
	},
	rangeLabelButton: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: spacing.xs,
		justifyContent: "center",
		minWidth: 142,
		paddingHorizontal: spacing.xs,
		paddingVertical: spacing.xs,
	},
	rangeNavigator: {
		alignItems: "center",
		flexDirection: "row",
		flexShrink: 1,
		gap: spacing.xs,
	},
	rangeToggle: {
		backgroundColor: themeColors.border,
		borderRadius: 999,
		flexDirection: "row",
		gap: spacing.xs,
		padding: spacing.xs,
		width: 148,
	},
	modalActions: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	modalBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.32)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	modalCard: {
		backgroundColor: themeColors.surface,
		borderRadius: 20,
		gap: spacing.md,
		padding: spacing.lg,
		width: "100%",
	},
	modalSubtitle: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	routineToggleButtonGroup: { 
		justifyContent: "center", 
		gap: spacing.lg,
		marginBottom: spacing.sm
	},
	disabledIcon: {
		opacity: 0.35,
	},
	footnoteRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.xs,
		marginTop: spacing.md,
	},
	footnoteText: {
		...typography.caption,
		color: themeColors.textSecondary,
		flex: 1,
	},
	summaryCardButtonGroup: {
		flexDirection: "row",
		justifyContent: "center",
		gap: spacing.sm,
		marginTop: spacing.md
	},
	summarySubtitle: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: 2,
	},
	validationText: {
		color: themeColors.error,
		fontSize: 12,
		fontWeight: "700",
	},
});
}
