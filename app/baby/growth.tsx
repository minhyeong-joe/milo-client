import { useMemo } from "react";
import { useAppPreferences , useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import type { LocalGrowthRecord } from "@/services/growth/growthOfflineStore";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { formatBabyAge } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function GrowthRecordsScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { selectedBaby } = useBabySelection();
	const { growthRecords, isLoading, loadGrowthRecords } = useGrowthData();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<View style={styles.header}>
				<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
					<Ionicons color={themeColors.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Text style={globalStyles.sectionTitleText}>Edit Growth</Text>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.push("/baby/add-measurement")}
					style={[styles.headerButton, styles.addButton]}
				>
					<Ionicons color={themeColors.surface} name="add" size={22} />
				</Pressable>
			</View>

			<ScrollView
				contentContainerStyle={styles.content}
				refreshControl={
					<RefreshControl
						refreshing={isLoading}
						tintColor={themeColors.primary}
						onRefresh={() => void loadGrowthRecords({ sync: true })}
					/>
				}
			>
				{!selectedBaby ? (
					<View style={globalStyles.card}>
						<Text style={globalStyles.bodyText}>Select a baby to view growth records.</Text>
					</View>
				) : null}

				{selectedBaby && growthRecords.length === 0 ? (
					<View style={[globalStyles.card, styles.emptyCard]}>
						<Text style={styles.emptyTitle}>No measurements yet</Text>
						<Text style={globalStyles.bodyText}>Add weight, height, or head size to start tracking growth.</Text>
					</View>
				) : null}

				{growthRecords.map((record) => (
					<GrowthRecordCard
						birthdate={selectedBaby?.birthdate}
						key={record.id}
						lengthUnit={preferredLengthUnit}
						onPress={() => router.push({
							pathname: "/baby/add-measurement",
							params: { growthId: record.id },
						})}
						record={record}
						weightUnit={preferredWeightUnit}
					/>
				))}
			</ScrollView>
		</SafeAreaView>
	);
}

function GrowthRecordCard({
	birthdate,
	lengthUnit,
	onPress,
	record,
	weightUnit,
}: {
	birthdate?: string;
	lengthUnit: "cm" | "in";
	onPress: () => void;
	record: LocalGrowthRecord;
	weightUnit: "kg" | "lb";
}) {
	const { globalStyles, styles } = useThemeStyles();
	const ageAtMeasurement = birthdate
		? formatBabyAge(birthdate, parseDateKey(record.measuredDate))
		: null;

	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={globalStyles.card}>
			<View style={globalStyles.rowBetween}>
				<View>
					<Text style={styles.recordDate}>{record.measuredDate}</Text>
					{ageAtMeasurement ? (
						<Text style={styles.recordAge}>{ageAtMeasurement} old</Text>
					) : null}
				</View>
				{record.syncStatus === "pending" || record.syncStatus === "failed" ? (
					<Text style={[
						styles.syncBadge,
						record.syncStatus === "failed" && styles.syncBadgeFailed,
					]}>
						{record.syncStatus === "failed" ? "Sync failed" : "Pending"}
					</Text>
				) : null}
			</View>
			<View style={styles.measurementGrid}>
				<MeasurementValue
					label="Weight"
					value={formatWeight(record.weightGrams, weightUnit)}
				/>
				<MeasurementValue
					label="Height"
					value={formatLength(record.heightMm, lengthUnit)}
				/>
				<MeasurementValue
					label="Head size"
					value={formatLength(record.headCircumferenceMm, lengthUnit)}
				/>
			</View>
			{record.syncStatus === "failed" && record.syncError ? (
				<Text style={styles.errorText}>{record.syncError}</Text>
			) : null}
		</Pressable>
	);
}

function MeasurementValue({ label, value }: { label: string; value: string }) {
	const { styles } = useThemeStyles();
	return (
		<View style={styles.measurementItem}>
			<Text style={styles.measurementLabel}>{label}</Text>
			<Text style={styles.measurementText}>{value}</Text>
		</View>
	);
}

function formatLength(valueMm: number | null, unit: "cm" | "in") {
	if (typeof valueMm !== "number") return "--";
	const value = unit === "cm" ? valueMm / 10 : valueMm / 25.4;

	return `${formatDecimal(value)} ${unit}`;
}

function formatWeight(valueGrams: number | null, unit: "kg" | "lb") {
	if (typeof valueGrams !== "number") return "--";
	const value = unit === "kg" ? valueGrams / 1000 : valueGrams / 453.59237;

	return `${formatDecimal(value)} ${unit}`;
}

function formatDecimal(value: number) {
	return value.toFixed(1).replace(/\.0$/, "");
}

function parseDateKey(value: string) {
	return new Date(`${value}T00:00:00`);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	addButton: {
		backgroundColor: themeColors.primary,
		borderRadius: 999,
	},
	content: {
		gap: spacing.md,
		padding: spacing.md,
	},
	emptyCard: {
		gap: spacing.xs,
	},
	emptyTitle: {
		...typography.sectionTitle,
		color: themeColors.textPrimary,
	},
	errorText: {
		color: themeColors.error,
		fontSize: 12,
		fontWeight: "700",
		marginTop: spacing.sm,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	headerButton: {
		alignItems: "center",
		height: 40,
		justifyContent: "center",
		minWidth: 40,
	},
	measurementGrid: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	measurementItem: {
		flex: 1,
		gap: 2,
	},
	measurementLabel: {
		...typography.caption,
		color: themeColors.textSecondary,
	},
	measurementText: {
		color: themeColors.textPrimary,
		fontSize: 14,
		fontWeight: "800",
	},
	recordDate: {
		...typography.itemTitle,
		color: themeColors.textPrimary,
	},
	recordAge: {
		...typography.caption,
		color: themeColors.textSecondary,
		marginTop: 2,
	},
	syncBadge: {
		...typography.caption,
		backgroundColor: "#F1EFFD",
		borderRadius: 999,
		color: themeColors.primary,
		overflow: "hidden",
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	syncBadgeFailed: {
		backgroundColor: "#FEE2E2",
		color: themeColors.error,
	},
});
}
