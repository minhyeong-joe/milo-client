import type { RoutineKind } from "@/data/homeData";
import type {
	DiaperPatternLog,
	MealPatternLog,
	RoutinePatternLog,
	RoutineStatsDay,
	SleepPatternLog,
} from "@/services/api/routine";

const DAY_MINUTES = 1440;
const POINT_CLUSTER_GAP_MINUTES = 90;
const SLEEP_CLUSTER_GAP_MINUTES = 120;

export type RoutinePatternInsight = {
	id: string;
	kind: RoutineKind;
	label: string;
	sortMinute: number;
	supportCount: number;
	timeLabel: string;
	type: string;
};

type PointOccurrence = {
	dateKey: string;
	id: string;
	kind: "diaper" | "meal";
	minute: number;
	type: string;
};

type SleepOccurrence = {
	dateKey: string;
	durationMinutes: number;
	id: string;
	kind: "sleep";
	minute: number;
	type: string;
};

type ClusterableOccurrence = PointOccurrence | SleepOccurrence;

const COMPACT_LABELS: Record<RoutineKind, Record<string, string>> = {
	diaper: {
		both: "Both",
		dirty: "Dirty",
		dry: "Dry",
		wet: "Wet",
	},
	meal: {
		breastfeed: "Breastfeed",
		breastMilk: "Breast Milk",
		formula: "Formula",
		solid: "Solid",
	},
	sleep: {
		nap: "Nap",
		nighttime: "Night Sleep",
	},
};

export function buildRoutinePatternInsights(
	days: RoutineStatsDay[],
	timeZone?: string,
) {
	const occurrences = normalizeOccurrences(days, timeZone);

	return {
		diaper: buildInsightsForKind(occurrences.diaper, "diaper", POINT_CLUSTER_GAP_MINUTES),
		meal: buildInsightsForKind(occurrences.meal, "meal", POINT_CLUSTER_GAP_MINUTES),
		sleep: buildInsightsForKind(occurrences.sleep, "sleep", SLEEP_CLUSTER_GAP_MINUTES),
	} satisfies Record<RoutineKind, RoutinePatternInsight[]>;
}

function normalizeOccurrences(days: RoutineStatsDay[], timeZone?: string) {
	const sleepIds = new Set<string>();
	const occurrences: Record<RoutineKind, ClusterableOccurrence[]> = {
		diaper: [],
		meal: [],
		sleep: [],
	};

	for (const day of days) {
		for (const log of day.logs) {
			if (log.kind === "meal") {
				const occurrence = normalizePointOccurrence(log, "meal", timeZone);
				if (occurrence) {
					occurrences.meal.push(occurrence);
				}
			} else if (log.kind === "diaper") {
				const occurrence = normalizePointOccurrence(log, "diaper", timeZone);
				if (occurrence) {
					occurrences.diaper.push(occurrence);
				}
			} else if (!sleepIds.has(log.id) && log.endTime) {
				sleepIds.add(log.id);
				const occurrence = normalizeSleepOccurrence(log, timeZone);
				if (occurrence) {
					occurrences.sleep.push(occurrence);
				}
			}
		}
	}

	return occurrences;
}

function normalizePointOccurrence(
	log: DiaperPatternLog | MealPatternLog,
	kind: "diaper" | "meal",
	timeZone?: string,
): PointOccurrence | null {
	const parts = getTimeParts(log.time, timeZone);

	if (!parts) {
		return null;
	}

	return {
		dateKey: parts.dateKey,
		id: log.id,
		kind,
		minute: parts.minuteOfDay,
		type: log.type,
	};
}

function normalizeSleepOccurrence(
	log: SleepPatternLog,
	timeZone?: string,
): SleepOccurrence | null {
	if (!log.endTime) {
		return null;
	}

	const start = getTimeParts(log.startTime, timeZone);
	const startTime = new Date(log.startTime).getTime();
	const endTime = new Date(log.endTime).getTime();

	if (!start || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
		return null;
	}

	return {
		dateKey: start.dateKey,
		durationMinutes: Math.round((endTime - startTime) / 60000),
		id: log.id,
		kind: "sleep",
		minute: start.minuteOfDay,
		type: log.type,
	};
}

function buildInsightsForKind(
	occurrences: ClusterableOccurrence[],
	kind: RoutineKind,
	gapMinutes: number,
) {
	const activeDayCount = new Set(occurrences.map((occurrence) => occurrence.dateKey)).size;
	const minimumSupport = activeDayCount <= 1 ? 1 : 2;
	const byType = new Map<string, ClusterableOccurrence[]>();

	for (const occurrence of occurrences) {
		const current = byType.get(occurrence.type) ?? [];
		current.push(occurrence);
		byType.set(occurrence.type, current);
	}

	const insights: RoutinePatternInsight[] = [];

	for (const [type, typeOccurrences] of byType) {
		for (const cluster of clusterOccurrences(typeOccurrences, gapMinutes)) {
			if (cluster.length < minimumSupport) {
				continue;
			}

			const medianMinute = getCircularMedianMinute(cluster.map((occurrence) => occurrence.minute));
			const typeLabel = getCompactTypeLabel(kind, type);

			insights.push({
				id: `${kind}:${type}:${medianMinute}:${cluster.length}`,
				kind,
				label: typeLabel,
				sortMinute: medianMinute,
				supportCount: cluster.length,
				timeLabel: buildTimeLabel(kind, medianMinute, cluster),
				type,
			});
		}
	}

	return insights.sort((left, right) =>
		right.supportCount - left.supportCount ||
		left.sortMinute - right.sortMinute ||
		left.label.localeCompare(right.label),
	);
}

function clusterOccurrences<T extends ClusterableOccurrence>(occurrences: T[], gapMinutes: number) {
	if (occurrences.length <= 1) {
		return occurrences.length === 1 ? [[occurrences[0]]] : [];
	}

	const sorted = [...occurrences].sort((left, right) => left.minute - right.minute);
	const breakIndex = getLargestCircularGapBreakIndex(sorted.map((occurrence) => occurrence.minute));
	const rotated = rotateFromBreak(sorted, breakIndex);
	let offset = 0;
	let previousMinute = rotated[0]?.minute ?? 0;
	const unwrapped = rotated.map((occurrence, index) => {
		if (index > 0 && occurrence.minute < previousMinute) {
			offset += DAY_MINUTES;
		}

		previousMinute = occurrence.minute;

		return {
			clusterMinute: occurrence.minute + offset,
			occurrence,
		};
	});
	const clusters: T[][] = [];
	let current: typeof unwrapped = [];

	for (const occurrence of unwrapped) {
		const previous = current[current.length - 1];

		if (previous && occurrence.clusterMinute - previous.clusterMinute > gapMinutes) {
			clusters.push(current.map((item) => item.occurrence));
			current = [];
		}

		current.push(occurrence);
	}

	if (current.length > 0) {
		clusters.push(current.map((item) => item.occurrence));
	}

	return clusters;
}

function getLargestCircularGapBreakIndex(minutes: number[]) {
	let largestGap = -1;
	let breakIndex = 0;

	for (let index = 0; index < minutes.length; index += 1) {
		const current = minutes[index];
		const next = minutes[(index + 1) % minutes.length] + (index === minutes.length - 1 ? DAY_MINUTES : 0);
		const gap = next - current;

		if (gap > largestGap) {
			largestGap = gap;
			breakIndex = (index + 1) % minutes.length;
		}
	}

	return breakIndex;
}

function rotateFromBreak<T>(items: T[], breakIndex: number) {
	return [...items.slice(breakIndex), ...items.slice(0, breakIndex)];
}

function getCircularMedianMinute(minutes: number[]) {
	const sorted = [...minutes].sort((left, right) => left - right);
	const breakIndex = getLargestCircularGapBreakIndex(sorted);
	const rotated = rotateFromBreak(sorted, breakIndex);
	let offset = 0;
	let previousMinute = rotated[0] ?? 0;
	const unwrapped = rotated.map((minute, index) => {
		if (index > 0 && minute < previousMinute) {
			offset += DAY_MINUTES;
		}

		previousMinute = minute;

		return minute + offset;
	});

	return normalizeMinute(Math.round(getMedian(unwrapped)));
}

function buildTimeLabel(
	kind: RoutineKind,
	startMinute: number,
	cluster: ClusterableOccurrence[],
) {
	if (kind !== "sleep") {
		return formatMinuteOfDay(startMinute);
	}

	const durations = cluster
		.filter((occurrence): occurrence is SleepOccurrence => occurrence.kind === "sleep")
		.map((occurrence) => occurrence.durationMinutes);
	const duration = Math.round(getMedian(durations));
	const endMinute = normalizeMinute(startMinute + duration);

	return `${formatMinuteOfDay(startMinute)} - ${formatMinuteOfDay(endMinute)}`;
}

function getMedian(values: number[]) {
	if (values.length === 0) {
		return 0;
	}

	const sorted = [...values].sort((left, right) => left - right);
	const midpoint = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 1) {
		return sorted[midpoint];
	}

	return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function getTimeParts(value: string, timeZone?: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	if (timeZone) {
		const parts = new Intl.DateTimeFormat("en-US", {
			day: "2-digit",
			hour: "2-digit",
			hourCycle: "h23",
			minute: "2-digit",
			month: "2-digit",
			timeZone,
			year: "numeric",
		}).formatToParts(date);
		const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

		return {
			dateKey: `${byType.year}-${byType.month}-${byType.day}`,
			minuteOfDay: Number(byType.hour) * 60 + Number(byType.minute),
		};
	}

	return {
		dateKey: getLocalDateKey(date),
		minuteOfDay: date.getHours() * 60 + date.getMinutes(),
	};
}

function getLocalDateKey(date: Date) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function getCompactTypeLabel(kind: RoutineKind, type: string) {
	return COMPACT_LABELS[kind][type] ?? type;
}

function normalizeMinute(value: number) {
	return ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function formatMinuteOfDay(minuteOfDay: number) {
	const normalizedMinute = normalizeMinute(minuteOfDay);
	const hour24 = Math.floor(normalizedMinute / 60);
	const minute = normalizedMinute % 60;
	const hour12 = hour24 % 12 || 12;
	const suffix = hour24 < 12 ? "AM" : "PM";

	return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
