import { SyncStatusCard } from "@/components/sync/SyncStatusCard";
import { useAppPreferences } from "@/context/AppPreferencesContext";
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
	const { session } = useAuthSession();
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
	const localPatternDateSet = useMemo(
		() => new Set(dailyLogs.map((day) => day.date)),
		[dailyLogs],
	);
	const displayedPatternStats = useMemo(
		() => mergeRoutineStatsForDisplay(localPatternStats, patternStats, localPatternDateSet),
		[localPatternDateSet, localPatternStats, patternStats],
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
			if (session) {
				const cachedStats = await loadCachedRoutineStats({
					babyId: selectedBaby.id,
					endDate: patternEndDateKey,
					startDate: patternStartDate,
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
		session,
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

function buildRoutineStatsSummary(days: RoutineStatsResponse["days"]): RoutineStatsResponse["summary"] {
	const safeDivide = (value: number, divisor: number) => divisor > 0 ? value / divisor : 0;
	const mealActiveDays = new Set<string>();
	const diaperActiveDays = new Set<string>();
	const sleepActiveDays = new Set<string>();
	const mealTypeStats = {
		breastfeed: { activeDays: new Set<string>(), count: 0, durationMinutes: 0 },
		breastMilk: { activeDays: new Set<string>(), amountMl: 0, count: 0 },
		formula: { activeDays: new Set<string>(), amountMl: 0, count: 0 },
		solid: { activeDays: new Set<string>(), bowlCount: 0, bowls: 0, count: 0, gramCount: 0, grams: 0 },
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
					if (typeof log.amountBowl === "number") {
						mealTypeStats.solid.bowlCount += 1;
						mealTypeStats.solid.bowls += log.amountBowl;
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
					totalBowls: mealTypeStats.solid.bowls,
					totalGrams: mealTypeStats.solid.grams,
					bowlEntryCount: mealTypeStats.solid.bowlCount,
					gramEntryCount: mealTypeStats.solid.gramCount,
					totalSessions: mealTypeStats.solid.count,
					avgBowlsPerSession: safeDivide(
						mealTypeStats.solid.bowls,
						mealTypeStats.solid.bowlCount,
					),
					avgGramsPerSession: safeDivide(
						mealTypeStats.solid.grams,
						mealTypeStats.solid.gramCount,
					),
					avgSessionsPerActiveDay: safeDivide(
						mealTypeStats.solid.count,
						mealTypeStats.solid.activeDays.size,
					),
					avgBowlsPerActiveDay: safeDivide(
						mealTypeStats.solid.bowls,
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
