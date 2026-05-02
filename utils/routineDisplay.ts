import type { PreferredVolumeUnit, RoutineEvent, RoutineKind } from "@/data/homeData";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
	const date = new Date(`${value}T00:00:00`);
	const current = currentTime ? new Date(currentTime) : new Date();
	const today = new Date(current.getFullYear(), current.getMonth(), current.getDate());
	const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

export function getLastRoutineActionLabel(
	events: RoutineEvent[],
	kind: RoutineKind,
	currentTime: string,
) {
	const latest = events
		.filter((event) => event.kind === kind)
		.map((event) => new Date(getRoutineEventTime(event)).getTime())
		.sort((a, b) => b - a)[0];

	if (!latest) {
		return "No logs yet";
	}

	const diffMinutes = Math.max(0, Math.round((new Date(currentTime).getTime() - latest) / 60000));

	if (diffMinutes < 60) {
		return `Last: ${diffMinutes}m ago`;
	}

	const hours = Math.floor(diffMinutes / 60);
	const minutes = diffMinutes % 60;

	if (hours < 24) {
		return minutes === 0 ? `Last: ${hours}h ago` : `Last: ${hours}h ${minutes}m ago`;
	}

	const days = Math.floor(hours / 24);
	return days === 1 ? "Last: yesterday" : `Last: ${days}d ago`;
}
