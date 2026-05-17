export type TimelineTimeZoneMode = "baby" | "device";

export type TimeZoneOption = {
	abbreviation: string;
	label: string;
	offsetLabel: string;
	offsetMinutes: number;
	timeZone: string;
};

const FALLBACK_TIME_ZONE = "America/Los_Angeles";

const TIME_ZONE_LABELS: Record<string, string> = {
	"Africa/Johannesburg": "South Africa",

	"America/Anchorage": "Alaska",
	"America/Chicago": "US Central",
	"America/Denver": "US Mountain",
	"America/Los_Angeles": "US Pacific",
	"America/New_York": "US Eastern",
	"America/Phoenix": "Arizona",

	"America/Sao_Paulo": "Brazil",

	"Asia/Dubai": "UAE",
	"Asia/Hong_Kong": "Hong Kong",
	"Asia/Seoul": "Korea",
	"Asia/Shanghai": "China",
	"Asia/Singapore": "Singapore",
	"Asia/Tokyo": "Japan",

	"Australia/Sydney": "Australia Eastern",

	"Europe/Berlin": "Central Europe",
	"Europe/London": "United Kingdom",

	"Pacific/Auckland": "New Zealand",
	"Pacific/Honolulu": "Hawaii",

	UTC: "UTC",
};

const FALLBACK_TIME_ZONES = Object.keys(TIME_ZONE_LABELS);

export function getDeviceTimeZone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
}

export function normalizeTimeZone(timeZone?: string | null) {
	if (!timeZone) {
		return getDeviceTimeZone();
	}

	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
		return timeZone;
	} catch {
		return getDeviceTimeZone();
	}
}

export function getTimeZoneOptions(currentTimeZone?: string | null) {
	const timeZones = new Set([
		...getSupportedTimeZones(),
		normalizeTimeZone(currentTimeZone),
		getDeviceTimeZone(),
	]);
	const now = new Date();

	return [...timeZones]
		.map((timeZone) => toTimeZoneOption(timeZone, now))
		.sort((left, right) =>
			left.offsetMinutes - right.offsetMinutes ||
			left.label.localeCompare(right.label),
		);
}

export function getTimeZoneDisplayLabel(timeZone?: string | null) {
	return toTimeZoneOption(normalizeTimeZone(timeZone), new Date()).label;
}

function getSupportedTimeZones() {
	const supportedValuesOf = (Intl as typeof Intl & {
		supportedValuesOf?: (key: "timeZone") => string[];
	}).supportedValuesOf;

	if (typeof supportedValuesOf === "function") {
		const supported = supportedValuesOf("timeZone");
		const preferred = supported.filter((timeZone) => TIME_ZONE_LABELS[timeZone]);
		return preferred.length > 0 ? preferred : supported;
	}

	return FALLBACK_TIME_ZONES;
}

function toTimeZoneOption(timeZone: string, date: Date): TimeZoneOption {
	const offsetMinutes = getOffsetMinutes(timeZone, date);
	const abbreviation = getTimeZoneAbbreviation(timeZone, date);
	const offsetLabel = formatOffset(offsetMinutes);
	const friendlyName = TIME_ZONE_LABELS[timeZone] ?? timeZone.replace(/_/g, " ");

	return {
		abbreviation,
		label: `${friendlyName} (${abbreviation})`,
		offsetLabel,
		offsetMinutes,
		timeZone,
	};
}

function getTimeZoneAbbreviation(timeZone: string, date: Date) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		timeZoneName: "short",
	}).formatToParts(date);

	return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

function getOffsetMinutes(timeZone: string, date: Date) {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	const asUtc = Date.UTC(
		Number(values.year),
		Number(values.month) - 1,
		Number(values.day),
		Number(values.hour) % 24,
		Number(values.minute),
		Number(values.second),
	);

	return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffset(offsetMinutes: number) {
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const absoluteMinutes = Math.abs(offsetMinutes);
	const hours = Math.floor(absoluteMinutes / 60);
	const minutes = absoluteMinutes % 60;

	return minutes === 0
		? `GMT${sign}${hours}`
		: `GMT${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}
