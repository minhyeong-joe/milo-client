import type { PreferredVolumeUnit, RoutineEvent } from "@/data/homeData";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

export function formatDuration(totalMinutes: number) {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) {
		return `${minutes}m`;
	}

	if (minutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${minutes}m`;
}

export function formatVolume(amountMl: number, preferredUnit: PreferredVolumeUnit) {
	if (preferredUnit === "oz") {
		return `${(amountMl / 29.5735).toFixed(1)} oz`;
	}

	return `${amountMl} ml`;
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
	return whole > 0 ? `${whole} ${fractionLabel}` : fractionLabel;
}
