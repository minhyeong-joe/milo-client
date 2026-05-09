import type {
	DailyRoutineSummary,
	RoutineConfig,
	RoutineKind,
} from "@/data/homeData";
import { colors } from "@/styles/globalStyles";
import { formatDuration, formatVolume } from "@/utils/routineDisplay";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RoutineIcon } from "./RoutineIcon";

function formatSolidSummary(totalServings?: number, totalGrams?: number) {
	const parts: string[] = [];

	if (totalServings) {
		parts.push(`${totalServings.toFixed(2)} servings`);
	}

	if (totalGrams) {
		parts.push(`${totalGrams} g`);
	}

	return parts.length ? ` (${parts.join(" + ")})` : "";
}

function SummaryRow({
	children,
	config,
	kind,
	title,
	total,
}: {
	children: ReactNode;
	config: RoutineConfig;
	kind: RoutineKind;
	title: string;
	total: string;
}) {
	const iconInfo = config.quickActions[kind];

	return (
		<View style={styles.summaryRow}>
			<View
				style={[styles.summaryIcon, { backgroundColor: iconInfo.backgroundColor }]}
			>
				<RoutineIcon size={30} kind={kind} />
			</View>
			<View style={styles.summaryContent}>
				<View style={styles.summaryHeader}>
					<Text style={styles.summaryTitle}>{title}</Text>
					<Text style={styles.summaryTotal}>{total}</Text>
				</View>
				<View style={styles.detailWrap}>{children}</View>
			</View>
		</View>
	);
}

function DetailText({ children }: { children: ReactNode }) {
	return <Text style={styles.detailText}>{children}</Text>;
}

export function RoutineSummary({
	config,
	summary,
}: {
	config: RoutineConfig;
	summary: DailyRoutineSummary;
}) {
	const { breastfeed, breastMilk, formula, solid } = summary.meals.byType;
	const { both, dirty, dry, wet } = summary.diapers.byType;
	const { nap, nighttime } = summary.sleep.byType;

	return (
		<View style={styles.summaryList}>
			<SummaryRow
				config={config}
				kind="meal"
				title="Meals"
				total={`${summary.meals.totalCount} total`}
			>
				{breastfeed.count ? (
					<DetailText>
						{config.mealTypes.breastfeed}: {breastfeed.count}
						{breastfeed.totalMinutes ? ` (${breastfeed.totalMinutes} min)` : ""}
					</DetailText>
				) : null}
				{breastMilk.count ? (
					<DetailText>
						{config.mealTypes.breastMilk}: {breastMilk.count}
						{breastMilk.totalAmountMl
							? ` (${formatVolume(breastMilk.totalAmountMl, config.preferredVolumeUnit)})`
							: ""}
					</DetailText>
				) : null}
				{formula.count ? (
					<DetailText>
						{config.mealTypes.formula}: {formula.count}
						{formula.totalAmountMl
							? ` (${formatVolume(formula.totalAmountMl, config.preferredVolumeUnit)})`
							: ""}
					</DetailText>
				) : null}
				{solid.count ? (
					<DetailText>
						{config.mealTypes.solid}: {solid.count}
						{formatSolidSummary(solid.totalServings, solid.totalGrams)}
					</DetailText>
				) : null}
			</SummaryRow>

			<SummaryRow
				config={config}
				kind="diaper"
				title="Diapers"
				total={`${summary.diapers.totalChanges} total`}
			>
				{wet ? (
					<DetailText>
						{config.diaperTypes.wet}: {wet}
					</DetailText>
				) : null}
				{dirty ? (
					<DetailText>
						{config.diaperTypes.dirty}: {dirty}
					</DetailText>
				) : null}
				{both ? (
					<DetailText>
						{config.diaperTypes.both}: {both}
					</DetailText>
				) : null}
				{dry ? (
					<DetailText>
						{config.diaperTypes.dry}: {dry}
					</DetailText>
				) : null}
			</SummaryRow>

			<SummaryRow
				config={config}
				kind="sleep"
				title="Sleep"
				total={`${summary.sleep.totalSessions} sessions (${formatDuration(summary.sleep.totalMinutes)})`}
			>
				{nap.count ? (
					<DetailText>
						{config.sleepTypes.nap}: {nap.count} (
						{formatDuration(nap.totalMinutes)})
					</DetailText>
				) : null}
				{nighttime.count ? (
					<DetailText>
						{config.sleepTypes.nighttime}: {nighttime.count} (
						{formatDuration(nighttime.totalMinutes)})
					</DetailText>
				) : null}
			</SummaryRow>
		</View>
	);
}

const styles = StyleSheet.create({
	detailText: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 17,
	},
	detailWrap: {
		gap: 2,
		marginTop: 4,
	},
	summaryContent: {
		flex: 1,
	},
	summaryHeader: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	summaryIcon: {
		alignItems: "center",
		borderRadius: 18,
		height: 36,
		justifyContent: "center",
		marginTop: 2,
		width: 36,
	},
	summaryList: {
		gap: 12,
		paddingTop: 12,
	},
	summaryRow: {
		alignItems: "flex-start",
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: 12,
		padding: 12,
	},
	summaryTitle: {
		color: colors.light.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
	summaryTotal: {
		color: colors.light.textPrimary,
		fontSize: 13,
		fontWeight: "800",
	},
});
