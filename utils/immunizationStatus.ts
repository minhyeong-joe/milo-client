import type { ImmunizationScheduleItem } from "@/services/api/immunizations";
import type { LocalImmunizationRecord } from "@/services/immunizations/immunizationOfflineStore";

export type ImmunizationStatus = "pastDue" | "dueNow" | "done" | "upcoming";

export type ScheduleListItem = {
	record?: LocalImmunizationRecord;
	scheduleItem: ImmunizationScheduleItem;
	status: ImmunizationStatus;
};

export function deriveImmunizationScheduleSections(
	scheduleItems: ImmunizationScheduleItem[],
	records: LocalImmunizationRecord[],
	birthdate?: string,
) {
	const ageMonths = birthdate ? getAgeMonths(birthdate) : 0;
	const byScheduleItem = new Map<string, LocalImmunizationRecord>();

	records.forEach((record) => {
		if (record.scheduleItemId && !byScheduleItem.has(record.scheduleItemId)) {
			byScheduleItem.set(record.scheduleItemId, record);
		}
	});

	const items = scheduleItems.map((scheduleItem) => {
		const record = byScheduleItem.get(scheduleItem.id);
		const status = record ? "done" : getScheduleStatus(scheduleItem, ageMonths);
		return { record, scheduleItem, status } satisfies ScheduleListItem;
	});

	const pastDue = items.filter((item) => item.status === "pastDue");
	const dueNow = items.filter((item) => item.status === "dueNow");
	const done = items
		.filter((item) => item.status === "done")
		.sort((left, right) => (right.record?.givenDate ?? "").localeCompare(left.record?.givenDate ?? ""));
	const upcoming = items.filter((item) => item.status === "upcoming");
	const upcomingGroups = groupUpcomingItems(upcoming);

	return { done, dueNow, pastDue, upcomingGroups };
}

export function getImmunizationCounts(
	scheduleItems: ImmunizationScheduleItem[],
	records: LocalImmunizationRecord[],
	birthdate?: string,
) {
	const { done, dueNow, pastDue } = deriveImmunizationScheduleSections(scheduleItems, records, birthdate);

	return {
		doneCount: done.length,
		dueCount: dueNow.length,
		pastDueCount: pastDue.length,
	};
}

export function getImmunizationStatusLabel(
	scheduleItems: ImmunizationScheduleItem[],
	records: LocalImmunizationRecord[],
	birthdate?: string,
) {
	if (!birthdate || scheduleItems.length === 0) {
		return "All clear";
	}

	const { dueCount, pastDueCount } = getImmunizationCounts(scheduleItems, records, birthdate);

	if (dueCount === 0 && pastDueCount === 0) {
		return "All clear";
	}

	return [
		dueCount > 0 ? `Due: ${dueCount}` : null,
		pastDueCount > 0 ? `Past due: ${pastDueCount}` : null,
	].filter(Boolean).join(", ");
}

export function getAgeMonths(dateKey: string) {
	const [year, month, day] = dateKey.split("-").map(Number);
	const birthdate = new Date(year, month - 1, day);
	const today = new Date();
	let months = (today.getFullYear() - birthdate.getFullYear()) * 12;
	months += today.getMonth() - birthdate.getMonth();

	if (today.getDate() < birthdate.getDate()) {
		months -= 1;
	}

	return Math.max(0, months);
}

function getScheduleStatus(
	scheduleItem: ImmunizationScheduleItem,
	ageMonths: number,
): Exclude<ImmunizationStatus, "done"> {
	const maxAge = scheduleItem.recommendedAgeMonthsMax ?? scheduleItem.recommendedAgeMonthsMin;

	if (ageMonths < scheduleItem.recommendedAgeMonthsMin) {
		return "upcoming";
	}

	if (ageMonths > maxAge) {
		return "pastDue";
	}

	return "dueNow";
}

function groupUpcomingItems(items: ScheduleListItem[]) {
	const groups = new Map<string, ScheduleListItem[]>();

	items.forEach((item) => {
		const currentItems = groups.get(item.scheduleItem.displayAge) ?? [];
		currentItems.push(item);
		groups.set(item.scheduleItem.displayAge, currentItems);
	});

	return Array.from(groups.entries()).map(([displayAge, groupItems]) => ({
		displayAge,
		items: groupItems,
	}));
}
