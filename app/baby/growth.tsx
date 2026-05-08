import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import type { LocalGrowthRecord } from "@/services/growth/growthOfflineStore";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GrowthRecordsScreen() {
	const router = useRouter();
	const { selectedBaby } = useBabySelection();
	const { growthRecords, isLoading, loadGrowthRecords } = useGrowthData();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<View style={styles.header}>
				<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
					<Ionicons color={colors.light.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Text style={globalStyles.sectionTitleText}>Edit Growth</Text>
				<Pressable
					accessibilityRole="button"
					onPress={() => router.push("/baby/add-measurement")}
					style={[styles.headerButton, styles.addButton]}
				>
					<Ionicons color={colors.light.surface} name="add" size={22} />
				</Pressable>
			</View>

			<ScrollView
				contentContainerStyle={styles.content}
				refreshControl={
					<RefreshControl
						refreshing={isLoading}
						tintColor={colors.light.primary}
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
	lengthUnit,
	onPress,
	record,
	weightUnit,
}: {
	lengthUnit: "cm" | "in";
	onPress: () => void;
	record: LocalGrowthRecord;
	weightUnit: "kg" | "lb";
}) {
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={globalStyles.card}>
			<View style={globalStyles.rowBetween}>
				<Text style={styles.recordDate}>{record.measuredDate}</Text>
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

const styles = StyleSheet.create({
	addButton: {
		backgroundColor: colors.light.primary,
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
		color: colors.light.textPrimary,
	},
	errorText: {
		color: colors.light.error,
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
		color: colors.light.textSecondary,
	},
	measurementText: {
		color: colors.light.textPrimary,
		fontSize: 14,
		fontWeight: "800",
	},
	recordDate: {
		...typography.itemTitle,
		color: colors.light.textPrimary,
	},
	syncBadge: {
		...typography.caption,
		backgroundColor: "#F1EFFD",
		borderRadius: 999,
		color: colors.light.primary,
		overflow: "hidden",
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
	},
	syncBadgeFailed: {
		backgroundColor: "#FEE2E2",
		color: colors.light.error,
	},
});
