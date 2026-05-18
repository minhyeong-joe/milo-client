import { SyncStatusCard } from "@/components/sync/SyncStatusCard";
import { useAppPreferences, useTimelineTimeZone , useAppTheme } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
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
import {
	loadCachedRoutineStats,
	saveRoutineStatsCache,
} from "@/services/routine/routineStatsCacheStore";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
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
export type PatternRangeMode = "custom" | "week" | "month";

const PRESET_PATTERN_RANGE_DAYS: Record<Exclude<PatternRangeMode, "custom">, number> = {
	month: 30,
	week: 7,
};
const REPORT_SYNC_TIMEOUT_MS = 10000;

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function ReportsScreen() {
	const { globalStyles, styles } = useThemeStyles();
	const { selectedBaby } = useBabySelection();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const { session } = useAuthSession();
	const {
		growthRecords,
		loadGrowthRecords: loadLocalGrowthRecords,
	} = useGrowthData();
	const { dailyLogs, syncPendingMutations } = useRoutineData();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();
	const {
		connectionStatus,
		markAuthRequired,
		markOffline,
		markOnline,
	} = useSync();
	const [activeTab, setActiveTab] = useState<ReportsTab>("patterns");
	const [patternRangeMode, setPatternRangeMode] = useState<PatternRangeMode>("week");
	const [patternEndDate, setPatternEndDate] = useState<string | null>(null);
	const [customPatternStartDate, setCustomPatternStartDate] = useState<string | null>(null);
	const [customPatternEndDate, setCustomPatternEndDate] = useState<string | null>(null);
	const [excludeTodayFromPatterns, setExcludeTodayFromPatterns] = useState(false);
	const initialPatternEndDate = selectedBaby
		? getDateKeyInTimeZone(new Date(), selectedBaby.timezone)
		: getDateKey(new Date());
	const initialPatternStartDate = addDays(
		initialPatternEndDate,
		-(PRESET_PATTERN_RANGE_DAYS.week - 1),
	);
	const [patternStats, setPatternStats] = useState<RoutineStatsResponse>(() =>
		createEmptyRoutineStats(initialPatternStartDate, initialPatternEndDate),
	);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [growthError, setGrowthError] = useState<string | null>(null);
	const [patternError, setPatternError] = useState<string | null>(null);

	const loadGrowthRecords = useCallback(async () => {
		if (!selectedBaby) {
			setGrowthError(null);
			return;
		}

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
		}
	}, [loadLocalGrowthRecords, markAuthRequired, markOffline, markOnline, selectedBaby]);

	const todayDateKey = selectedBaby
		? getDateKeyInTimeZone(new Date(), selectedBaby.timezone)
		: getDateKey(new Date());
	const presetPatternMaxDate = excludeTodayFromPatterns
		? addDays(todayDateKey, -1)
		: todayDateKey;
	const patternEndDateKey =
		patternRangeMode === "custom"
			? customPatternEndDate ?? todayDateKey
			: getPresetPatternEndDate(patternEndDate, presetPatternMaxDate);
	const patternDayCount =
		patternRangeMode === "custom"
			? getInclusiveDayCount(customPatternStartDate ?? patternEndDateKey, patternEndDateKey)
			: PRESET_PATTERN_RANGE_DAYS[patternRangeMode];
	const patternStartDate =
		patternRangeMode === "custom"
			? customPatternStartDate ?? patternEndDateKey
			: addDays(patternEndDateKey, -(patternDayCount - 1));
	const localPatternStats = useMemo(
		() => buildRoutineStatsFromLocalLogs(
			dailyLogs,
			patternStartDate,
			patternEndDateKey,
			timelineTimeZone,
		),
		[dailyLogs, patternEndDateKey, patternStartDate, timelineTimeZone],
	);
	const localPatternDateSet = useMemo(
		() => new Set(
			localPatternStats.days
				.filter((day) => day.logs.length > 0)
				.map((day) => day.date),
		),
		[localPatternStats],
	);
	const displayedPatternStats = useMemo(
		() => mergeRoutineStatsForDisplay(localPatternStats, patternStats, localPatternDateSet),
		[localPatternDateSet, localPatternStats, patternStats],
	);

	const refreshPatternStats = useCallback(async () => {
		const localStats = buildRoutineStatsFromLocalLogs(
			dailyLogs,
			patternStartDate,
			patternEndDateKey,
			timelineTimeZone,
		);

		if (!selectedBaby) {
			setPatternStats(localStats);
			setPatternError(null);
			return;
		}

		setPatternError(null);

		if (
			patternStats.startDate !== patternStartDate ||
			patternStats.endDate !== patternEndDateKey
		) {
			setPatternStats(localStats);
		}

		try {
			if (session) {
				const cachedStats = await loadCachedRoutineStats({
					babyId: selectedBaby.id,
					endDate: patternEndDateKey,
					startDate: patternStartDate,
					timeZone: timelineTimeZone,
					userId: session.user.id,
				});

				if (cachedStats) {
					setPatternStats(cachedStats);
				}
			}

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
			if (session) {
				await saveRoutineStatsCache({
					babyId: selectedBaby.id,
					stats: response,
					timeZone: timelineTimeZone,
					userId: session.user.id,
				});
			}
			markOnline();
		} catch (caughtError) {
			if (isAuthRequiredError(caughtError)) {
				markAuthRequired();
				setPatternError(AUTH_REQUIRED_SYNC_MESSAGE);
			} else {
				markOffline();
				setPatternError(getErrorMessage(caughtError));
			}
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
		session,
		syncPendingMutations,
		timelineTimeZone,
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
			await refreshPatternStats();
		} finally {
			setIsRefreshing(false);
		}
	}, [refreshPatternStats]);
	const changePatternRangeMode = useCallback((mode: PatternRangeMode) => {
		if (mode === "custom") {
			setPatternRangeMode("custom");
			return;
		}

		setPatternRangeMode(mode);
		setPatternEndDate(presetPatternMaxDate);
	}, [presetPatternMaxDate]);
	const applyCustomPatternRange = useCallback((startDate: string, endDate: string) => {
		const cappedEndDate = endDate > todayDateKey ? todayDateKey : endDate;
		const cappedStartDate = startDate > cappedEndDate ? cappedEndDate : startDate;

		setCustomPatternStartDate(cappedStartDate);
		setCustomPatternEndDate(cappedEndDate);
		setPatternRangeMode("custom");
	}, [todayDateKey]);
	const shiftPatternRange = useCallback((direction: -1 | 1) => {
		if (!selectedBaby) {
			return;
		}

		const shiftDays = patternDayCount * direction;

		if (patternRangeMode === "custom") {
			const shiftedEndDate = addDays(patternEndDateKey, shiftDays);
			const nextEndDate = direction > 0 && shiftedEndDate > todayDateKey ? todayDateKey : shiftedEndDate;
			const nextStartDate = addDays(nextEndDate, -(patternDayCount - 1));

			setCustomPatternStartDate(nextStartDate);
			setCustomPatternEndDate(nextEndDate);
			return;
		}

		setPatternEndDate((current) => {
			const currentEndDate = getPresetPatternEndDate(current, presetPatternMaxDate);
			const shiftedEndDate = addDays(currentEndDate, shiftDays);

			return direction > 0 && shiftedEndDate > presetPatternMaxDate
				? presetPatternMaxDate
				: shiftedEndDate;
		});
	}, [
		patternDayCount,
		patternEndDateKey,
		patternRangeMode,
		presetPatternMaxDate,
		selectedBaby,
		todayDateKey,
	]);

	const changeExcludeTodayFromPatterns = useCallback((excludeToday: boolean) => {
		setExcludeTodayFromPatterns(excludeToday);

		if (patternRangeMode !== "custom") {
			setPatternEndDate(excludeToday ? addDays(todayDateKey, -1) : todayDateKey);
		}
	}, [patternRangeMode, todayDateKey]);

	useEffect(() => {
		if (!selectedBaby) {
			setPatternEndDate(null);
			setCustomPatternStartDate(null);
			setCustomPatternEndDate(null);
			return;
		}

		setPatternEndDate(getDateKeyInTimeZone(new Date(), selectedBaby.timezone));
		setCustomPatternStartDate(null);
		setCustomPatternEndDate(null);
		setPatternRangeMode("week");
		setExcludeTodayFromPatterns(false);
	}, [selectedBaby]);

	useEffect(() => {
		let isMounted = true;

		if (!selectedBaby) {
			setPatternStats(localPatternStats);
			setPatternError(null);
			return;
		}

		setPatternStats((currentStats) =>
			currentStats.startDate === patternStartDate &&
			currentStats.endDate === patternEndDateKey
				? currentStats
				: localPatternStats,
		);

		if (!session) {
			return;
		}

		void loadCachedRoutineStats({
			babyId: selectedBaby.id,
			endDate: patternEndDateKey,
			startDate: patternStartDate,
			timeZone: timelineTimeZone,
			userId: session.user.id,
		}).then((cachedStats) => {
			if (isMounted && cachedStats) {
				setPatternStats(cachedStats);
			}
		});

		return () => {
			isMounted = false;
		};
	}, [
		localPatternStats,
		patternEndDateKey,
		patternStartDate,
		selectedBaby,
		session,
		timelineTimeZone,
	]);

	const sortedGrowthRecords = useMemo(
		() =>
			[...growthRecords].sort((left, right) =>
				left.measuredDate.localeCompare(right.measuredDate),
			),
		[growthRecords],
	);
	const retryActiveTab = activeTab === "growth" ? refreshGrowthRecords : refreshLogStats;
	const activeError = activeTab === "growth" ? growthError : patternError;

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={globalStyles.screenContent}>
				<Text style={globalStyles.titleText}>Reports</Text>

				<View style={styles.segmentedControl}>
					<TabButton
						isSelected={activeTab === "patterns"}
						label="Patterns"
						onPress={() => setActiveTab("patterns")}
					/>
					<TabButton
						isSelected={activeTab === "growth"}
						label="Growth"
						onPress={() => setActiveTab("growth")}
					/>
				</View>

				{activeError ? (
					<SyncStatusCard
						message={activeError}
						onRetry={() => void retryActiveTab()}
						status={connectionStatus === "authRequired" ? "authRequired" : "offline"}
					/>
				) : null}

				{activeTab === "patterns" ? (
					<PatternReportsContent
						canShiftNext={patternEndDateKey < (patternRangeMode === "custom"
							? todayDateKey
							: presetPatternMaxDate)}
						endDate={patternEndDateKey}
						excludeTodayFromPatterns={excludeTodayFromPatterns}
						isLoading={false}
						isRefreshing={isRefreshing}
						maxDate={todayDateKey}
						onCustomRangeApply={applyCustomPatternRange}
						onExcludeTodayChange={changeExcludeTodayFromPatterns}
						onRefresh={refreshLogStats}
						onRangeModeChange={changePatternRangeMode}
						onShiftRange={shiftPatternRange}
						rangeMode={patternRangeMode}
						selectedBaby={selectedBaby}
						startDate={patternStartDate}
						stats={displayedPatternStats}
						timeZone={timelineTimeZone}
					/>
				) : (
					<GrowthReportsContent
						isLoading={false}
						isRefreshing={isRefreshing}
						lengthUnit={preferredLengthUnit}
						onRefresh={refreshGrowthRecords}
						records={sortedGrowthRecords}
						selectedBaby={selectedBaby}
						weightUnit={preferredWeightUnit}
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
	timeZone?: string,
): RoutineStatsResponse {
	const stats = createEmptyRoutineStats(startDate, endDate);
	const daysByDate = new Map(stats.days.map((day) => [day.date, day]));

	for (const day of dailyLogs) {
		for (const event of day.timeline) {
			if (event.kind === "meal") {
				const statsDay = daysByDate.get(getDateKeyForInstant(new Date(event.time), timeZone));

				if (!statsDay) {
					continue;
				}

				statsDay.logs.push({
					amountServings: event.amountServings ?? null,
					amountGrams: event.amountGrams ?? null,
					amountMl: event.amountMl ?? null,
					durationMinutes: event.durationMinutes ?? null,
					id: event.id,
					kind: "meal",
					time: event.time,
					type: event.type,
				});
				continue;
			}

			if (event.kind === "diaper") {
				const statsDay = daysByDate.get(getDateKeyForInstant(new Date(event.time), timeZone));

				if (!statsDay) {
					continue;
				}

				statsDay.logs.push({
					id: event.id,
					kind: "diaper",
					time: event.time,
					type: event.type,
				});
				continue;
			}

			const sleepLog = {
				endTime: event.endTime ?? null,
				id: event.id,
				kind: "sleep",
				startTime: event.startTime,
				type: event.type,
			} as const;

			for (const date of getSleepOverlapDates(event.startTime, event.endTime ?? null, timeZone)) {
				daysByDate.get(date)?.logs.push(sleepLog);
			}
		}
	}

	return stats;
}

function mergeRoutineStatsForDisplay(
	localStats: RoutineStatsResponse,
	apiStats: RoutineStatsResponse,
	localDateSet: Set<string>,
) {
	if (
		apiStats.startDate !== localStats.startDate ||
		apiStats.endDate !== localStats.endDate
	) {
		return localStats;
	}

	const days = apiStats.days.map((apiDay, index) => {
		const localDay = localStats.days[index];

		if (localDateSet.has(apiDay.date)) {
			return {
				...apiDay,
				logs: localDay?.logs ?? [],
			};
		}

		const logsById = new Map(apiDay.logs.map((log) => [log.id, log]));

		for (const log of localDay?.logs ?? []) {
			logsById.set(log.id, log);
		}

		return {
			...apiDay,
			logs: Array.from(logsById.values()),
		};
	});

	return {
		...apiStats,
		days,
		summary: buildRoutineStatsSummary(days),
	};
}

function getSleepOverlapDates(startTime: string, endTime: string | null, timeZone?: string) {
	const start = new Date(startTime);
	const end = endTime ? new Date(endTime) : new Date();

	if (Number.isNaN(start.getTime())) {
		return [];
	}

	if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
		return [getDateKeyForInstant(start, timeZone)];
	}

	const startDate = getDateKeyForInstant(start, timeZone);
	const endDate = getDateKeyForInstant(end, timeZone);
	const dates: string[] = [];
	let current = startDate;

	while (current <= endDate) {
		dates.push(current);
		current = addDays(current, 1);
	}

	return dates;
}

function getDateKeyForInstant(value: Date, timeZone?: string) {
	return timeZone ? getDateKeyInTimeZone(value, timeZone) : getDateKey(value);
}

function buildRoutineStatsSummary(days: RoutineStatsResponse["days"]): RoutineStatsResponse["summary"] {
	const safeDivide = (value: number, divisor: number) => divisor > 0 ? value / divisor : 0;
	const mealActiveDays = new Set<string>();
	const diaperActiveDays = new Set<string>();
	const sleepActiveDays = new Set<string>();
	const mealTypeStats = {
		breastfeed: { activeDays: new Set<string>(), count: 0, durationMinutes: 0 },
		breastMilk: { activeDays: new Set<string>(), amountMl: 0, count: 0 },
		formula: { activeDays: new Set<string>(), amountMl: 0, count: 0 },
		solid: { activeDays: new Set<string>(), servingCount: 0, servings: 0, count: 0, gramCount: 0, grams: 0 },
	};
	const diaperTypeCounts = { both: 0, dirty: 0, dry: 0, wet: 0 };
	const sleepTypeStats = {
		nap: { count: 0, durationMinutes: 0 },
		nighttime: { count: 0, durationMinutes: 0 },
	};
	let mealCount = 0;
	let diaperCount = 0;
	let sleepCount = 0;
	let sleepDurationMinutes = 0;
	const countedSleepIds = new Set<string>();

	for (const day of days) {
		for (const log of day.logs) {
			if (log.kind === "meal") {
				mealActiveDays.add(day.date);
				mealCount += 1;

				if (log.type === "breastfeed") {
					mealTypeStats.breastfeed.activeDays.add(day.date);
					mealTypeStats.breastfeed.count += 1;
					mealTypeStats.breastfeed.durationMinutes += log.durationMinutes ?? 0;
				} else if (log.type === "breastMilk") {
					mealTypeStats.breastMilk.activeDays.add(day.date);
					mealTypeStats.breastMilk.count += 1;
					mealTypeStats.breastMilk.amountMl += log.amountMl ?? 0;
				} else if (log.type === "formula") {
					mealTypeStats.formula.activeDays.add(day.date);
					mealTypeStats.formula.count += 1;
					mealTypeStats.formula.amountMl += log.amountMl ?? 0;
				} else {
					mealTypeStats.solid.activeDays.add(day.date);
					mealTypeStats.solid.count += 1;
					if (typeof log.amountServings === "number") {
						mealTypeStats.solid.servingCount += 1;
						mealTypeStats.solid.servings += log.amountServings;
					}
					if (typeof log.amountGrams === "number") {
						mealTypeStats.solid.gramCount += 1;
						mealTypeStats.solid.grams += log.amountGrams;
					}
				}
			} else if (log.kind === "diaper") {
				diaperActiveDays.add(day.date);
				diaperCount += 1;
				diaperTypeCounts[log.type] += 1;
			} else {
				if (countedSleepIds.has(log.id)) {
					continue;
				}

				countedSleepIds.add(log.id);
				const durationMinutes = getSleepDurationMinutes(log.startTime, log.endTime);

				sleepActiveDays.add(day.date);
				sleepCount += 1;
				sleepDurationMinutes += durationMinutes;
				sleepTypeStats[log.type].count += 1;
				sleepTypeStats[log.type].durationMinutes += durationMinutes;
			}
		}
	}

	return {
		diaper: {
			activeDays: diaperActiveDays.size,
			totalChanges: diaperCount,
			avgChangesPerActiveDay: safeDivide(diaperCount, diaperActiveDays.size),
			byType: {
				both: { totalChanges: diaperTypeCounts.both, avgChangesPerActiveDay: safeDivide(diaperTypeCounts.both, diaperActiveDays.size) },
				dirty: { totalChanges: diaperTypeCounts.dirty, avgChangesPerActiveDay: safeDivide(diaperTypeCounts.dirty, diaperActiveDays.size) },
				dry: { totalChanges: diaperTypeCounts.dry, avgChangesPerActiveDay: safeDivide(diaperTypeCounts.dry, diaperActiveDays.size) },
				wet: { totalChanges: diaperTypeCounts.wet, avgChangesPerActiveDay: safeDivide(diaperTypeCounts.wet, diaperActiveDays.size) },
			},
		},
		meal: {
			activeDays: mealActiveDays.size,
			avgSessionsPerActiveDay: safeDivide(mealCount, mealActiveDays.size),
			totalSessions: mealCount,
			byType: {
				breastfeed: {
					activeDays: mealTypeStats.breastfeed.activeDays.size,
					totalSessions: mealTypeStats.breastfeed.count,
					totalDurationMinutes: mealTypeStats.breastfeed.durationMinutes,
					avgDurationMinutesPerSession: safeDivide(
						mealTypeStats.breastfeed.durationMinutes,
						mealTypeStats.breastfeed.count,
					),
					avgSessionsPerActiveDay: safeDivide(
						mealTypeStats.breastfeed.count,
						mealTypeStats.breastfeed.activeDays.size,
					),
					avgDurationMinutesPerActiveDay: safeDivide(
						mealTypeStats.breastfeed.durationMinutes,
						mealTypeStats.breastfeed.activeDays.size,
					),
				},
				breastMilk: {
					activeDays: mealTypeStats.breastMilk.activeDays.size,
					totalAmountMl: mealTypeStats.breastMilk.amountMl,
					totalSessions: mealTypeStats.breastMilk.count,
					avgAmountMlPerSession: safeDivide(
						mealTypeStats.breastMilk.amountMl,
						mealTypeStats.breastMilk.count,
					),
					avgSessionsPerActiveDay: safeDivide(
						mealTypeStats.breastMilk.count,
						mealTypeStats.breastMilk.activeDays.size,
					),
					avgAmountMlPerActiveDay: safeDivide(
						mealTypeStats.breastMilk.amountMl,
						mealTypeStats.breastMilk.activeDays.size,
					),
				},
				formula: {
					activeDays: mealTypeStats.formula.activeDays.size,
					totalAmountMl: mealTypeStats.formula.amountMl,
					totalSessions: mealTypeStats.formula.count,
					avgAmountMlPerSession: safeDivide(
						mealTypeStats.formula.amountMl,
						mealTypeStats.formula.count,
					),
					avgSessionsPerActiveDay: safeDivide(
						mealTypeStats.formula.count,
						mealTypeStats.formula.activeDays.size,
					),
					avgAmountMlPerActiveDay: safeDivide(
						mealTypeStats.formula.amountMl,
						mealTypeStats.formula.activeDays.size,
					),
				},
				solid: {
					activeDays: mealTypeStats.solid.activeDays.size,
					totalServings: mealTypeStats.solid.servings,
					totalGrams: mealTypeStats.solid.grams,
					servingEntryCount: mealTypeStats.solid.servingCount,
					gramEntryCount: mealTypeStats.solid.gramCount,
					totalSessions: mealTypeStats.solid.count,
					avgServingsPerSession: safeDivide(
						mealTypeStats.solid.servings,
						mealTypeStats.solid.servingCount,
					),
					avgGramsPerSession: safeDivide(
						mealTypeStats.solid.grams,
						mealTypeStats.solid.gramCount,
					),
					avgSessionsPerActiveDay: safeDivide(
						mealTypeStats.solid.count,
						mealTypeStats.solid.activeDays.size,
					),
					avgServingsPerActiveDay: safeDivide(
						mealTypeStats.solid.servings,
						mealTypeStats.solid.activeDays.size,
					),
					avgGramsPerActiveDay: safeDivide(
						mealTypeStats.solid.grams,
						mealTypeStats.solid.activeDays.size,
					),
				},
			},
		},
		sleep: {
			activeDays: sleepActiveDays.size,
			avgDurationMinutesPerActiveDay: safeDivide(sleepDurationMinutes, sleepActiveDays.size),
			avgSessionsPerActiveDay: safeDivide(sleepCount, sleepActiveDays.size),
			avgDurationMinutesPerSession: safeDivide(sleepDurationMinutes, sleepCount),
			totalDurationMinutes: sleepDurationMinutes,
			totalSessions: sleepCount,
			byType: {
				nap: {
					totalSessions: sleepTypeStats.nap.count,
					totalDurationMinutes: sleepTypeStats.nap.durationMinutes,
					avgDurationMinutesPerActiveDay: safeDivide(
						sleepTypeStats.nap.durationMinutes,
						sleepActiveDays.size,
					),
					avgSessionsPerActiveDay: safeDivide(sleepTypeStats.nap.count, sleepActiveDays.size),
					avgDurationMinutesPerSession: safeDivide(
						sleepTypeStats.nap.durationMinutes,
						sleepTypeStats.nap.count,
					)
				},
				nighttime: {
					totalSessions: sleepTypeStats.nighttime.count,
					totalDurationMinutes: sleepTypeStats.nighttime.durationMinutes,
					avgDurationMinutesPerActiveDay: safeDivide(
						sleepTypeStats.nighttime.durationMinutes,
						sleepActiveDays.size,
					),
					avgSessionsPerActiveDay: safeDivide(sleepTypeStats.nighttime.count, sleepActiveDays.size),
					avgDurationMinutesPerSession: safeDivide(
						sleepTypeStats.nighttime.durationMinutes,
						sleepTypeStats.nighttime.count,
					)
				},
			},
		},
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
	const { styles } = useThemeStyles();
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

function getPresetPatternEndDate(currentEndDate: string | null, presetMaxDate: string) {
	if (!currentEndDate || currentEndDate > presetMaxDate) {
		return presetMaxDate;
	}

	return currentEndDate;
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
				totalChanges: 0,
				avgChangesPerActiveDay: 0,
				byType: {
					both: { totalChanges: 0, avgChangesPerActiveDay: 0 },
					dirty: { totalChanges: 0, avgChangesPerActiveDay: 0 },
					dry: { totalChanges: 0, avgChangesPerActiveDay: 0 },
					wet: { totalChanges: 0, avgChangesPerActiveDay: 0 },
				},
			},
			meal: {
				activeDays: 0,
				totalSessions: 0,
				avgSessionsPerActiveDay: 0,
				byType: {
					breastfeed: {
						activeDays: 0,
						totalSessions: 0,
						totalDurationMinutes: 0,
						avgDurationMinutesPerSession: 0,
						avgDurationMinutesPerActiveDay: 0,
						avgSessionsPerActiveDay: 0,
					},
					breastMilk: {
						activeDays: 0,
						totalSessions: 0,
						totalAmountMl: 0,
						avgAmountMlPerSession: 0,
						avgAmountMlPerActiveDay: 0,
						avgSessionsPerActiveDay: 0,
					},
					formula: {
						activeDays: 0,
						totalSessions: 0,
						totalAmountMl: 0,
						avgAmountMlPerSession: 0,
						avgAmountMlPerActiveDay: 0,
						avgSessionsPerActiveDay: 0,
					},
					solid: {
						activeDays: 0,
						totalSessions: 0,
						totalServings: 0,
						totalGrams: 0,
						servingEntryCount: 0,
						gramEntryCount: 0,
						avgServingsPerSession: 0,
						avgGramsPerSession: 0,
						avgServingsPerActiveDay: 0,
						avgGramsPerActiveDay: 0,
						avgSessionsPerActiveDay: 0,
					},
				},
			},
			sleep: {
				activeDays: 0,
				totalSessions: 0,
				totalDurationMinutes: 0,
				avgDurationMinutesPerActiveDay: 0,
				avgDurationMinutesPerSession: 0,
				avgSessionsPerActiveDay: 0,
				byType: {
					nap: {
						totalSessions: 0,
						totalDurationMinutes: 0,
						avgDurationMinutesPerActiveDay: 0,
						avgDurationMinutesPerSession: 0,
						avgSessionsPerActiveDay: 0,
					},
					nighttime: {
						totalSessions: 0,
						totalDurationMinutes: 0,
						avgDurationMinutesPerActiveDay: 0,
						avgDurationMinutesPerSession: 0,
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

function getSleepDurationMinutes(startTime: string, endTime: string | null) {
	if (!endTime) {
		return 0;
	}

	const start = new Date(startTime).getTime();
	const end = new Date(endTime).getTime();

	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return 0;
	}

	return Math.round((end - start) / 60000);
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

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	segmentedControl: {
		backgroundColor: themeColors.border,
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
		backgroundColor: themeColors.surface,
	},
	tabButtonText: {
		...typography.label,
		color: themeColors.textSecondary,
	},
	tabButtonTextSelected: {
		color: themeColors.textPrimary,
	}
});
}
