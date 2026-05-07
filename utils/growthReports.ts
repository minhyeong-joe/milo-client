import {
	WHO_GROWTH_STANDARDS,
	type WhoGrowthMetric,
	type WhoGrowthPoint,
	type WhoGrowthSex,
} from "@/data/whoGrowthStandards";
import type { BabySex } from "@/services/api/babies";

export type GrowthMetric = "weight" | "height" | "head";

type WhoReference = {
	median: number;
	percentile: number;
	zScore: number;
} | null;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getAgeInDays(birthdate: string, measuredDate: string) {
	const birthTime = parseDateOnlyUtc(birthdate);
	const measuredTime = parseDateOnlyUtc(measuredDate);

	if (birthTime === null || measuredTime === null) {
		return null;
	}

	return Math.max(0, Math.round((measuredTime - birthTime) / MILLISECONDS_PER_DAY));
}

export function getWhoReference(
	metric: GrowthMetric,
	sex: BabySex,
	ageDays: number,
	value: number,
): WhoReference {
	const referenceMetric = getWhoMetric(metric);
	const table = WHO_GROWTH_STANDARDS[referenceMetric][sex as WhoGrowthSex];
	const point = getInterpolatedWhoPoint(table, ageDays);

	if (!point) {
		return null;
	}

	const [, l, median, s] = point;
	const zScore = l === 0 ? Math.log(value / median) / s : ((value / median) ** l - 1) / (l * s);

	return {
		median,
		percentile: normalCdf(zScore) * 100,
		zScore,
	};
}

export function formatGrowthValue(
	metric: GrowthMetric,
	value: number,
	units: { length: "cm" | "in"; weight: "kg" | "lb" },
) {
	if (metric === "weight") {
		return units.weight === "kg"
			? `${formatNumber(value, 2)} kg`
			: `${formatNumber(value * 2.2046226218, 1)} lb`;
	}

	return units.length === "cm"
		? `${formatNumber(value, 1)} cm`
		: `${formatNumber(value / 2.54, 1)} in`;
}

export function toDisplayGrowthValue(
	metric: GrowthMetric,
	value: number,
	units: { length: "cm" | "in"; weight: "kg" | "lb" },
) {
	if (metric === "weight") {
		return units.weight === "kg" ? value : value * 2.2046226218;
	}

	return units.length === "cm" ? value : value / 2.54;
}

function getWhoMetric(metric: GrowthMetric): WhoGrowthMetric {
	return metric === "height" ? "length" : metric;
}

function getInterpolatedWhoPoint(
	table: readonly WhoGrowthPoint[],
	ageDays: number,
): WhoGrowthPoint | null {
	if (ageDays < table[0][0] || ageDays > table[table.length - 1][0]) {
		return null;
	}

	const lowerIndex = Math.floor(ageDays);
	const lower = table[lowerIndex];
	const upper = table[Math.min(lowerIndex + 1, table.length - 1)];

	if (!lower || !upper || lower[0] === upper[0]) {
		return lower ?? null;
	}

	const progress = (ageDays - lower[0]) / (upper[0] - lower[0]);

	return [
		ageDays,
		interpolate(lower[1], upper[1], progress),
		interpolate(lower[2], upper[2], progress),
		interpolate(lower[3], upper[3], progress),
	];
}

function interpolate(start: number, end: number, progress: number) {
	return start + (end - start) * progress;
}

function normalCdf(zScore: number) {
	return 0.5 * (1 + erf(zScore / Math.SQRT2));
}

function erf(value: number) {
	const sign = value < 0 ? -1 : 1;
	const x = Math.abs(value);
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;
	const t = 1 / (1 + p * x);
	const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

	return sign * y;
}

function parseDateOnlyUtc(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

	if (!match) {
		return null;
	}

	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatNumber(value: number, digits: number) {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
	});
}
