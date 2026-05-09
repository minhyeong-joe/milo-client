import type { PreferredVolumeUnit, RoutineEvent, RoutineKind } from "@/data/homeData";
import { DiaperAverage, MealAverage, RoutineStatsSummary, SleepAverage } from "@/services/api/routine";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const ML_PER_OZ = 29.5735;

function padDatePart(value: number) {
	return value.toString().padStart(2, "0");
}

export function getLocalDateKey(value: string | Date) {
	const date = value instanceof Date ? value : new Date(value);

	return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function parseDateKey(value: string) {
	const [year, month, day] = value.split("-").map(Number);

	return new Date(year, month - 1, day);
}

export function getDateKeyStartMs(value: string) {
	return parseDateKey(value).getTime();
}

export function formatBabyAge(birthdate: string, today = new Date()) {
	const born = new Date(`${birthdate}T00:00:00`);
	let months =
		(today.getFullYear() - born.getFullYear()) * 12 +
		today.getMonth() -
		born.getMonth();

	const monthAnchor = new Date(born);
	monthAnchor.setMonth(born.getMonth() + months);

	if (monthAnchor > today) {
		months -= 1;
		monthAnchor.setMonth(monthAnchor.getMonth() - 1);
	}

	const days = Math.max(0, Math.floor((today.getTime() - monthAnchor.getTime()) / MS_PER_DAY));
	const monthLabel = months === 1 ? "month" : "months";
	const dayLabel = days === 1 ? "day" : "days";

	return `${months} ${monthLabel} • ${days} ${dayLabel}`;
}

export function formatDuration(totalMinutes: number | null) {
	const hours = Math.floor((totalMinutes ?? 0) / 60);
	const minutes = (totalMinutes ?? 0) % 60;

	if (hours === 0) {
		return `${minutes}m`;
	}

	if (minutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${minutes.toFixed(0)}m`;
}

export function formatVolume(amountMl: number, preferredUnit: PreferredVolumeUnit) {
	if (preferredUnit === "oz") {
		return `${mlToOz(amountMl).toFixed(1)} oz`;
	}

	return `${Math.round(amountMl)} mL`;
}

export function mlToOz(amountMl: number) {
	return amountMl / ML_PER_OZ;
}

export function ozToMl(amountOz: number) {
	return Math.round(amountOz * ML_PER_OZ);
}

export function formatOzInput(amountOz: number) {
	return amountOz.toFixed(1);
}

export function formatClockTime(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

export function formatDayLabel(value: string, currentTime?: string) {
	const date = parseDateKey(value);
	const current = currentTime ? new Date(currentTime) : new Date();
	const today = new Date(current.getFullYear(), current.getMonth(), current.getDate());
	const target = parseDateKey(value);
	const diffDays = Math.round((today.getTime() - target.getTime()) / MS_PER_DAY);
	const formatted = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
	}).format(date);

	if (diffDays === 0) {
		return { date: formatted, label: "Today" };
	}

	if (diffDays === 1) {
		return { date: formatted, label: "Yesterday" };
	}

	return {
		date: formatted,
		label: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date),
	};
}

export function getSleepDurationMinutes(startTime: string, endTime: string) {
	return Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
}

export function getRoutineEventTime(event: RoutineEvent) {
	if (event.kind === "sleep") {
		return event.endTime ?? event.startTime;
	}

	return event.time;
}

export function formatBowlAmount(amount: number) {
	const whole = Math.floor(amount);
	const fraction = amount - whole;
	let fractionLabel = "";
	if (fraction === 0.25) {
		fractionLabel = "¼";
	} else if (fraction === 0.5) {
		fractionLabel = "½";
	} else if (fraction === 0.75) {
		fractionLabel = "¾";
	}
	if (whole > 0 && fractionLabel) {
		return `${whole} ${fractionLabel}`;
	}

	return whole > 0 ? String(whole) : fractionLabel;
}

export function formatSolidAmount({
	amountBowl,
	amountGrams,
}: {
	amountBowl?: number | null;
	amountGrams?: number | null;
}) {
	const parts: string[] = [];

	if (amountBowl) {
		parts.push(`${formatBowlAmount(amountBowl)} bowl`);
	}

	if (amountGrams) {
		parts.push(`${amountGrams} g`);
	}

	return parts.join(" + ");
}

export function getAveragePerActiveDay(
	kind: RoutineKind,
	summary: RoutineStatsSummary[RoutineKind],
) {
	if (kind === "diaper") {
		return (summary as DiaperAverage).avgChangesPerActiveDay;
	}

	return (summary as MealAverage | SleepAverage).avgSessionsPerActiveDay;
}
