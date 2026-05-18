import type {
	DiaperType,
	MealType,
	PreferredVolumeUnit,
	RoutineKind,
	SleepType,
} from "@/data/homeData";
import type {
	MealPatternLog,
	RoutinePatternLog,
	RoutineStatsDay,
	SleepPatternLog,
} from "@/services/api/routine";
import { formatDuration, mlToOz } from "@/utils/routineDisplay";

const MS_PER_MINUTE = 60000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type MealSnapshotMetric = "duration" | "grams" | "sessions" | "servings" | "volume";
export type SleepSnapshotMetric = "duration" | "sessions";
export type SnapshotMetric = MealSnapshotMetric | SleepSnapshotMetric | "changes";
export type SnapshotSubtype = DiaperType | MealType | SleepType;

export type SnapshotSegment = {
	color: string;
	type: SnapshotSubtype;
	value: number;
};

export type SnapshotChartDay = {
	date: string;
	segments: SnapshotSegment[];
	totalValue: number;
};

export type SnapshotChartData = {
	days: SnapshotChartDay[];
	emptyState: string;
	metric: SnapshotMetric;
	subtitle: string;
	title: string;
	yAxis: SnapshotYAxis;
};

export type SnapshotYAxis = {
	labels: string[];
	maxValue: number;
	noOfSections: number;
	roundToDigits: number;
	showFractionalValues: boolean;
	stepValue: number;
};

export const MEAL_TYPES: MealType[] = ["breastfeed", "breastMilk", "formula", "solid"];
export const MEAL_TYPE_PRIORITY: MealType[] = ["formula", "breastMilk", "solid", "breastfeed"];
export const DIAPER_TYPES: DiaperType[] = ["wet", "dirty", "both", "dry"];
export const SLEEP_TYPES: SleepType[] = ["nap", "nighttime"];

export const TYPE_COLORS = {
	diaper: {
		both: "#5a4d06",
		dirty: "#A16207",
		dry: "#94A3B8",
		wet: "#4da6da",
	},
	meal: {
		breastMilk: "#31888b",
		breastfeed: "#7C4DFF",
		formula: "#48caae",
		solid: "#EC4899",
	},
	sleep: {
		nap: "#3a77da",
		nighttime: "#163079",
	},
} as const;

export const TYPE_LABELS = {
	diaper: {
		both: "Both",
		dirty: "Dirty",
		dry: "Dry",
		wet: "Wet",
	},
	meal: {
		breastMilk: "Breast Milk",
		breastfeed: "Breastfeed",
		formula: "Formula",
		solid: "Solid",
	},
	sleep: {
		nap: "Nap",
		nighttime: "Night Sleep",
	},
} as const;

export const METRIC_LABELS: Record<SnapshotMetric, string> = {
	changes: "Changes",
	duration: "Duration",
	grams: "Grams",
	sessions: "Sessions",
	servings: "Servings",
	volume: "Volume",
};

export function getDefaultMealType(days: RoutineStatsDay[]) {
	for (const type of MEAL_TYPE_PRIORITY) {
		if (days.some((day) => day.logs.some((log) => log.kind === "meal" && log.type === type))) {
			return type;
		}
	}

	return "formula";
}

export function getMealMetricOptions(type: MealType): MealSnapshotMetric[] {
	if (type === "breastfeed") {
		return ["duration", "sessions"];
	}

	if (type === "solid") {
		return ["servings", "grams", "sessions"];
	}

	return ["volume", "sessions"];
}

export function getDefaultMealMetric(type: MealType): MealSnapshotMetric {
	return getMealMetricOptions(type)[0];
}

export function buildMealSnapshotChartData({
	days,
	metric,
	preferredVolumeUnit,
	type,
}: {
	days: RoutineStatsDay[];
	metric: MealSnapshotMetric;
	preferredVolumeUnit: PreferredVolumeUnit;
	type: MealType;
}): SnapshotChartData {
	const chartDays = days.map((day) => {
		const logs = day.logs.filter(
			(log): log is MealPatternLog => log.kind === "meal" && log.type === type,
		);
		const value = sumMealValue(logs, metric, preferredVolumeUnit);

		return {
			date: day.date,
			segments: value > 0 ? [{ color: getTypeColor("meal", type), type, value }] : [],
			totalValue: value,
		};
	});
	const yAxis = buildYAxis(chartDays.map((day) => day.totalValue), getAxisKind(metric));
	const typeLabel = getTypeLabel("meal", type);

	return {
		days: chartDays,
		emptyState: `No ${typeLabel} ${getMetricNoun(metric, preferredVolumeUnit).toLowerCase()} logged in this range yet.`,
		metric,
		subtitle: `${typeLabel} ${getMetricNoun(metric, preferredVolumeUnit).toLowerCase()} by day`,
		title: "Meal Snapshot",
		yAxis,
	};
}

export function buildDiaperSnapshotChartData({
	days,
	enabledTypes,
}: {
	days: RoutineStatsDay[];
	enabledTypes: DiaperType[];
}): SnapshotChartData {
	const chartDays = days.map((day) => {
		const segments: SnapshotSegment[] = enabledTypes
			.flatMap((type) => {
				const value = day.logs.filter((log) => log.kind === "diaper" && log.type === type).length;

				return value > 0
					? [{ color: getTypeColor("diaper", type), type, value }]
					: [];
			});

		return {
			date: day.date,
			segments,
			totalValue: segments.reduce((total, segment) => total + segment.value, 0),
		};
	});

	return {
		days: chartDays,
		emptyState: "No diaper changes logged for the selected types in this range yet.",
		metric: "changes",
		subtitle: "Daily changes by selected types",
		title: "Diaper Snapshot",
		yAxis: buildYAxis(chartDays.map((day) => day.totalValue), "count"),
	};
}

export function buildSleepSnapshotChartData({
	days,
	enabledTypes,
	metric,
	timeZone,
}: {
	days: RoutineStatsDay[];
	enabledTypes: SleepType[];
	metric: SleepSnapshotMetric;
	timeZone?: string;
}): SnapshotChartData {
	const countedSessions = new Set<string>();
	const chartDays = days.map((day) => {
		const segments: SnapshotSegment[] = enabledTypes
			.flatMap((type) => {
				const logs = day.logs.filter(
					(log): log is SleepPatternLog => log.kind === "sleep" && log.type === type,
				);
				const value = metric === "duration"
					? logs.reduce((total, log) => total + getSleepOverlapMinutes(log, day.date, timeZone), 0)
					: logs.reduce((total, log) => {
							const sessionKey = `${day.date}:${log.id}`;
							if (countedSessions.has(log.id) || !sleepStartsOnDate(log, day.date, timeZone)) {
								return total;
							}

							countedSessions.add(log.id);
							countedSessions.add(sessionKey);
							return total + 1;
						}, 0);

				return value > 0
					? [{ color: getTypeColor("sleep", type), type, value }]
					: [];
			});

		return {
			date: day.date,
			segments,
			totalValue: segments.reduce((total, segment) => total + segment.value, 0),
		};
	});

	return {
		days: chartDays,
		emptyState: `No sleep ${metric} logged for the selected types in this range yet.`,
		metric,
		subtitle: `Daily sleep ${metric}`,
		title: "Sleep Snapshot",
		yAxis: buildYAxis(chartDays.map((day) => day.totalValue), metric === "duration" ? "duration" : "count"),
	};
}

export function getTypeColor(kind: RoutineKind, type: SnapshotSubtype) {
	return (TYPE_COLORS[kind] as Record<string, string>)[type];
}

export function getTypeLabel(kind: RoutineKind, type: SnapshotSubtype) {
	return (TYPE_LABELS[kind] as Record<string, string>)[type];
}

function sumMealValue(
	logs: MealPatternLog[],
	metric: MealSnapshotMetric,
	preferredVolumeUnit: PreferredVolumeUnit,
) {
	if (metric === "sessions") {
		return logs.length;
	}

	if (metric === "duration") {
		return logs.reduce((total, log) => total + (log.durationMinutes ?? 0), 0);
	}

	if (metric === "servings") {
		return logs.reduce((total, log) => total + (log.amountServings ?? 0), 0);
	}

	if (metric === "grams") {
		return logs.reduce((total, log) => total + (log.amountGrams ?? 0), 0);
	}

	const totalMl = logs.reduce((total, log) => total + (log.amountMl ?? 0), 0);
	return preferredVolumeUnit === "oz" ? mlToOz(totalMl) : totalMl;
}

function getSleepOverlapMinutes(log: SleepPatternLog, dateKey: string, timeZone?: string) {
	if (!log.endTime) {
		return 0;
	}

	const start = new Date(log.startTime).getTime();
	const end = new Date(log.endTime).getTime();

	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return 0;
	}

	const dayStart = getDateStartMs(dateKey, timeZone);
	const dayEnd = dayStart + MS_PER_DAY;
	const overlapStart = Math.max(start, dayStart);
	const overlapEnd = Math.min(end, dayEnd);

	return overlapEnd > overlapStart
		? Math.round((overlapEnd - overlapStart) / MS_PER_MINUTE)
		: 0;
}

function sleepStartsOnDate(log: SleepPatternLog, dateKey: string, timeZone?: string) {
	return getDateKeyForInstant(new Date(log.startTime), timeZone) === dateKey;
}

function getDateStartMs(dateKey: string, timeZone?: string) {
	if (!timeZone) {
		const [year, month, day] = dateKey.split("-").map(Number);
		return new Date(year, month - 1, day).getTime();
	}

	const approximateUtc = new Date(`${dateKey}T00:00:00.000Z`);
	const offset = getTimeZoneOffsetMs(approximateUtc, timeZone);
	return approximateUtc.getTime() - offset;
}

function getTimeZoneOffsetMs(value: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(value);
	const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	const asUtc = Date.UTC(
		Number(byType.year),
		Number(byType.month) - 1,
		Number(byType.day),
		Number(byType.hour),
		Number(byType.minute),
		Number(byType.second),
	);

	return asUtc - value.getTime();
}

function getDateKeyForInstant(value: Date, timeZone?: string) {
	if (timeZone) {
		const parts = new Intl.DateTimeFormat("en-US", {
			day: "2-digit",
			month: "2-digit",
			timeZone,
			year: "numeric",
		}).formatToParts(value);
		const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

		return `${byType.year}-${byType.month}-${byType.day}`;
	}

	const year = value.getFullYear();
	const month = `${value.getMonth() + 1}`.padStart(2, "0");
	const day = `${value.getDate()}`.padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function getAxisKind(metric: SnapshotMetric) {
	if (metric === "duration") return "duration";
	if (metric === "sessions" || metric === "changes") return "count";
	return "decimal";
}

function buildYAxis(values: number[], kind: "count" | "decimal" | "duration"): SnapshotYAxis {
	const max = Math.max(0, ...values);

	if (kind === "count") {
		const stepValue = chooseIntegerStep(Math.max(1, max));
		const noOfSections = Math.max(1, Math.ceil(max / stepValue));
		const maxValue = noOfSections * stepValue;

		return {
			labels: Array.from({ length: noOfSections + 1 }, (_, index) => String(index * stepValue)),
			maxValue,
			noOfSections,
			roundToDigits: 0,
			showFractionalValues: false,
			stepValue,
		};
	}

	if (kind === "duration") {
		const stepValue = chooseDurationStep(Math.max(1, max));
		const noOfSections = Math.max(1, Math.ceil(max / stepValue));
		const maxValue = noOfSections * stepValue;

		return {
			labels: Array.from({ length: noOfSections + 1 }, (_, index) => formatDuration(index * stepValue)),
			maxValue,
			noOfSections,
			roundToDigits: 0,
			showFractionalValues: false,
			stepValue,
		};
	}

	const stepValue = chooseDecimalStep(Math.max(1, max));
	const noOfSections = Math.max(1, Math.ceil(max / stepValue));
	const maxValue = noOfSections * stepValue;

	return {
		labels: Array.from({ length: noOfSections + 1 }, (_, index) => formatAxisNumber(index * stepValue)),
		maxValue,
		noOfSections,
		roundToDigits: 1,
		showFractionalValues: true,
		stepValue,
	};
}

function chooseIntegerStep(maxValue: number) {
	if (maxValue <= 4) return 1;
	if (maxValue <= 10) return 2;
	if (maxValue <= 20) return 5;
	return 10;
}

function chooseDurationStep(maxValue: number) {
	if (maxValue <= 60) return 15;
	if (maxValue <= 180) return 30;
	if (maxValue <= 480) return 120;
	return 240;
}

function chooseDecimalStep(maxValue: number) {
	if (maxValue <= 4) return 1;
	if (maxValue <= 10) return 2;
	if (maxValue <= 30) return 5;
	if (maxValue <= 100) return 20;
	return 50;
}

function formatAxisNumber(value: number) {
	return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
}

function getMetricNoun(metric: SnapshotMetric, preferredVolumeUnit: PreferredVolumeUnit) {
	if (metric === "volume") {
		return preferredVolumeUnit === "oz" ? "Ounces" : "Milliliters";
	}

	return METRIC_LABELS[metric];
}
