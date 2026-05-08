import { SyncStatusCard } from "@/components/sync/SyncStatusCard";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import { useRoutineData } from "@/context/RoutineDataContext";
import {
	AUTH_REQUIRED_SYNC_MESSAGE,
	OFFLINE_SYNC_MESSAGE,
	useSync,
} from "@/context/SyncContext";
import type { RoutineEvent } from "@/data/homeData";
import { ApiError } from "@/services/api/httpClient";
import { getRoutineStats, type RoutineStatsResponse } from "@/services/api/routine";
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
const REPORT_SYNC_TIMEOUT_MS = 10000;

export default function ReportsScreen() {
	const { selectedBaby } = useBabySelection();
	const {
		growthRecords,
		loadGrowthRecords: loadLocalGrowthRecords,
	} = useGrowthData();
	const { dailyLogs, syncPendingMutations } = useRoutineData();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();
	const {
		connectionStatus,
		error: syncError,
		markAuthRequired,
		markOffline,
		markOnline,
		status: syncStatus,
	} = useSync();
	const [activeTab, setActiveTab] = useState<ReportsTab>("growth");
	const [patternRangeMode, setPatternRangeMode] = useState<PatternRangeMode>("week");
	const [patternEndDate, setPatternEndDate] = useState<string | null>(null);
	const initialPatternEndDate = selectedBaby
		? getDateKeyInTimeZone(new Date(), selectedBaby.timezone)
		: getDateKey(new Date());
	const initialPatternStartDate = addDays(
		initialPatternEndDate,
		-(PATTERN_RANGE_DAYS.week - 1),
	);
	const [patternStats, setPatternStats] = useState<RoutineStatsResponse>(() =>
		createEmptyRoutineStats(initialPatternStartDate, initialPatternEndDate),
	);
	const [isGrowthLoading, setIsGrowthLoading] = useState(false);
	const [isPatternLoading, setIsPatternLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [growthError, setGrowthError] = useState<string | null>(null);
	const [patternError, setPatternError] = useState<string | null>(null);

	const loadGrowthRecords = useCallback(async () => {
		if (!selectedBaby) {
			setGrowthError(null);
			return;
		}

		setIsGrowthLoading(true);
		setGrowthError(null);

		try {
			await withTimeout(
				loadLocalGrowthRecords({ sync: true }),
				REPORT_SYNC_TIMEOUT_MS,
			);
			markOnline();
		} catch (caughtError) {
			if (isAuthRequiredError(caughtError)) {
				markAuthRequired();
				setGrowthError(AUTH_REQUIRED_SYNC_MESSAGE);
			} else {
				markOffline();
				setGrowthError(getErrorMessage(caughtError));
			}
		} finally {
			setIsGrowthLoading(false);
		}
	}, [loadLocalGrowthRecords, markAuthRequired, markOffline, markOnline, selectedBaby]);

	const patternDayCount = PATTERN_RANGE_DAYS[patternRangeMode];
	const patternEndDateKey =
		patternEndDate ??
		(selectedBaby
			? getDateKeyInTimeZone(new Date(), selectedBaby.timezone)
			: getDateKey(new Date()));
	const patternStartDate = addDays(patternEndDateKey, -(patternDayCount - 1));
	const localPatternStats = useMemo(
		() => buildRoutineStatsFromLocalLogs(dailyLogs, patternStartDate, patternEndDateKey),
		[dailyLogs, patternEndDateKey, patternStartDate],
	);
	const displayedPatternStats = useMemo(
		() => mergeRoutineStatsForDisplay(localPatternStats, patternStats),
		[localPatternStats, patternStats],
	);

	const loadPatternStats = useCallback(async () => {
		const localStats = buildRoutineStatsFromLocalLogs(dailyLogs, patternStartDate, patternEndDateKey);

		if (!selectedBaby) {
			setPatternStats(localStats);
			setPatternError(null);
			return;
		}

		setIsPatternLoading(true);
		setPatternError(null);

		if (
			patternStats.startDate !== patternStartDate ||
			patternStats.endDate !== patternEndDateKey
		) {
			setPatternStats(localStats);
		}

		try {
			await syncPendingMutations();
			const response = await withTimeout(
				getRoutineStats({
					babyId: selectedBaby.id,
					endDate: patternEndDateKey,
					startDate: patternStartDate,
				}),
				REPORT_SYNC_TIMEOUT_MS,
			);
			setPatternStats(response);
			markOnline();
		} catch (caughtError) {
			if (isAuthRequiredError(caughtError)) {
				markAuthRequired();
				setPatternError(AUTH_REQUIRED_SYNC_MESSAGE);
			} else {
				markOffline();
				setPatternError(getErrorMessage(caughtError));
			}
		} finally {
			setIsPatternLoading(false);
		}
	}, [
		dailyLogs,
		markAuthRequired,
		markOffline,
		markOnline,
		patternEndDateKey,
		patternStartDate,
		patternStats.endDate,
		patternStats.startDate,
		selectedBaby,
		syncPendingMutations,
	]);

	const refreshGrowthRecords = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await loadGrowthRecords();
		} finally {
			setIsRefreshing(false);
		}
	}, [loadGrowthRecords]);

	const refreshLogStats = useCallback(async () => {
		setIsRefreshing(true);

		try {
			await loadPatternStats();
		} finally {
			setIsRefreshing(false);
		}
	}, [loadPatternStats]);
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
		if (activeTab === "growth") {
			void loadGrowthRecords();
		}
	}, [activeTab, loadGrowthRecords]);

	useEffect(() => {
		if (activeTab === "patterns") {
			void loadPatternStats();
		}
	}, [activeTab, loadPatternStats]);

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
	const retryActiveTab = activeTab === "growth" ? loadGrowthRecords : loadPatternStats;
	const activeError = activeTab === "growth" ? growthError : patternError;
	const activeIsLoading = activeTab === "growth" ? isGrowthLoading : isPatternLoading;
	const hasActiveData =
		activeTab === "growth"
			? growthRecords.length > 0
			: displayedPatternStats.days.some((day) => day.logs.length > 0);

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

				{activeIsLoading && hasActiveData ? (
					<SyncStatusCard status="syncing" />
				) : null}

				{!activeIsLoading && syncStatus !== "syncing" && connectionStatus !== "online" ? (
					<SyncStatusCard
						message={syncError ?? activeError}
						onRetry={() => void retryActiveTab()}
						status={connectionStatus === "authRequired" ? "authRequired" : "offline"}
					/>
				) : null}

				{activeTab === "growth" ? (
					<GrowthReportsContent
						isLoading={isGrowthLoading}
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
						isLoading={isPatternLoading}
						isRefreshing={isRefreshing}
						onRefresh={refreshLogStats}
						onRangeModeChange={setPatternRangeMode}
						onShiftRange={shiftPatternRange}
						rangeMode={patternRangeMode}
						selectedBaby={selectedBaby}
						startDate={patternStartDate}
						stats={displayedPatternStats}
					/>
				)}
			</View>
		</SafeAreaView>
	);
}

function buildRoutineStatsFromLocalLogs(
	dailyLogs: { date: string; timeline: RoutineEvent[] }[],
	startDate: string,
	endDate: string,
): RoutineStatsResponse {
	const stats = createEmptyRoutineStats(startDate, endDate);
	const daysByDate = new Map(stats.days.map((day) => [day.date, day]));

	for (const day of dailyLogs) {
		const statsDay = daysByDate.get(day.date);

		if (!statsDay) {
			continue;
		}

		statsDay.logs = day.timeline.map((event) => {
			if (event.kind === "meal") {
				return {
					amountBowl: event.amountBowl ?? null,
					amountGrams: event.amountGrams ?? null,
					amountMl: event.amountMl ?? null,
					durationMinutes: event.durationMinutes ?? null,
					id: event.id,
					kind: "meal",
					time: event.time,
					type: event.type,
				};
			}

			if (event.kind === "diaper") {
				return {
					id: event.id,
					kind: "diaper",
					time: event.time,
					type: event.type,
				};
			}

			return {
				endTime: event.endTime ?? null,
				id: event.id,
				kind: "sleep",
				startTime: event.startTime,
				type: event.type,
			};
		});
	}

	return stats;
}

function mergeRoutineStatsForDisplay(
	localStats: RoutineStatsResponse,
	apiStats: RoutineStatsResponse,
) {
	if (
		apiStats.startDate !== localStats.startDate ||
		apiStats.endDate !== localStats.endDate
	) {
		return localStats;
	}

	return {
		...apiStats,
		days: apiStats.days.map((apiDay, index) => {
			const localDay = localStats.days[index];
			const logsById = new Map(apiDay.logs.map((log) => [log.id, log]));

			for (const log of localDay?.logs ?? []) {
				logsById.set(log.id, log);
			}

			return {
				...apiDay,
				logs: Array.from(logsById.values()),
			};
		}),
	};
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

function getErrorMessage(_error: unknown) {
	return OFFLINE_SYNC_MESSAGE;
}

function isAuthRequiredError(error: unknown) {
	return error instanceof ApiError &&
		(error.status === 401 || error.status === 403);
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
				activeDays: 0,
				avgChangesPerActiveDay: 0,
				byType: {
					both: { avgChangesPerActiveDay: 0 },
					dirty: { avgChangesPerActiveDay: 0 },
					dry: { avgChangesPerActiveDay: 0 },
					wet: { avgChangesPerActiveDay: 0 },
				},
			},
			meal: {
				activeDays: 0,
				avgSessionsPerActiveDay: 0,
				byType: {
					breastfeed: {
						activeDays: 0,
						avgDurationMinutesPerSession: 0,
						avgSessionsPerActiveDay: 0,
					},
					breastMilk: {
						activeDays: 0,
						avgAmountMlPerSession: 0,
						avgSessionsPerActiveDay: 0,
					},
					formula: {
						activeDays: 0,
						avgAmountMlPerSession: 0,
						avgSessionsPerActiveDay: 0,
					},
					solid: {
						activeDays: 0,
						avgBowlsPerSession: 0,
						avgGramsPerSession: 0,
						avgSessionsPerActiveDay: 0,
					},
				},
			},
			sleep: {
				activeDays: 0,
				avgDurationMinutesPerActiveDay: 0,
				avgSessionsPerActiveDay: 0,
				byType: {
					nap: {
						avgDurationMinutesPerActiveDay: 0,
						avgSessionsPerActiveDay: 0,
					},
					nighttime: {
						avgDurationMinutesPerActiveDay: 0,
						avgSessionsPerActiveDay: 0,
					},
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error("SYNC_TIMEOUT")), timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
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
