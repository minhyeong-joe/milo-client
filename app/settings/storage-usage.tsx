import { SettingsHeader } from "@/components/settings/SettingsRows";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORAGE_LIMIT_GB = 5;
const STORAGE_USED_GB = 1.2;
const SELECTED_BABY_USED_GB = 0.9;
const OTHER_STORAGE_GB = STORAGE_USED_GB - SELECTED_BABY_USED_GB;

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function StorageUsageScreen() {
	const router = useRouter();
	const { globalStyles, styles } = useThemeStyles();
	const { babies, selectedBaby } = useBabySelection();
	const isOwnerCapable = selectedBaby?.isOwner === true;
	const remainingGb = STORAGE_LIMIT_GB - STORAGE_USED_GB;
	const breakdown = getStorageBreakdown({
		babies,
		isOwnerCapable,
		selectedBabyName: selectedBaby?.name ?? "Selected baby",
	});

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Storage Usage" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Storage Overview</Text>
					<View style={styles.progressTrack}>
						{breakdown.map((item) => (
							<View
								key={item.label}
								style={[
									styles.progressSegment,
									{
										backgroundColor: item.color,
										width: `${(item.valueGb / STORAGE_LIMIT_GB) * 100}%`,
									},
								]}
							/>
						))}
					</View>
					<Text style={styles.progressLabel}>
						{formatGb(STORAGE_USED_GB)} of {formatGb(STORAGE_LIMIT_GB)} used
					</Text>
				</View>

				<View style={globalStyles.card}>
					{breakdown.map((item) => (
						<View key={item.label} style={styles.breakdownRow}>
							<View
								style={[styles.legendDot, { backgroundColor: item.color }]}
							/>
							<Text style={styles.breakdownLabel}>{item.label}</Text>
							<Text style={styles.breakdownValue}>
								{formatGb(item.valueGb)}
							</Text>
						</View>
					))}
					<InfoRow label="Total Used" value={formatGb(STORAGE_USED_GB)} />
					<InfoRow label="Total Limit" value={formatGb(STORAGE_LIMIT_GB)} />
					<InfoRow label="Remaining" value={formatGb(remainingGb)} />
				</View>

				<View style={globalStyles.card}>
					<Text style={styles.helper}>
						Storage is shared across babies owned by the account owner.
					</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	const { styles } = useThemeStyles();

	return (
		<View style={styles.infoRow}>
			<Text style={styles.infoLabel}>{label}</Text>
			<Text style={styles.infoValue}>{value}</Text>
		</View>
	);
}

function getStorageBreakdown({
	babies,
	isOwnerCapable,
	selectedBabyName,
}: {
	babies: { name: string }[];
	isOwnerCapable: boolean;
	selectedBabyName: string;
}) {
	if (!isOwnerCapable) {
		return [
			{
				color: "#7C5CE7",
				label: selectedBabyName,
				valueGb: SELECTED_BABY_USED_GB,
			},
			{ color: "#64748B", label: "Other storage", valueGb: OTHER_STORAGE_GB },
		];
	}

	const visibleBabies =
		babies.length > 0 ? babies : [{ name: selectedBabyName }];
	const babyBreakdown = visibleBabies.map((baby, index) => ({
		color: index === 0 ? "#7C5CE7" : index === 1 ? "#2FAE62" : "#64748B",
		label: baby.name,
		valueGb:
			index === 0
				? SELECTED_BABY_USED_GB
				: Math.max(
						0.1,
						OTHER_STORAGE_GB / Math.max(visibleBabies.length - 1, 1),
					),
	}));

	if (visibleBabies.length === 1 && OTHER_STORAGE_GB > 0) {
		babyBreakdown.push({
			color: "#64748B",
			label: "Other Babies",
			valueGb: OTHER_STORAGE_GB,
		});
	}

	return babyBreakdown;
}

function formatGb(value: number) {
	return `${value.toFixed(value % 1 === 0 ? 0 : 1)} GB`;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		breakdownLabel: {
			...typography.body,
			color: themeColors.textPrimary,
			flex: 1,
		},
		breakdownRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.md,
		},
		breakdownValue: {
			...typography.body,
			color: themeColors.textSecondary,
		},
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		helper: {
			...typography.caption,
			color: themeColors.textSecondary,
			lineHeight: 18,
		},
		infoLabel: {
			...typography.caption,
			color: themeColors.textSecondary,
			textTransform: "uppercase",
		},
		infoRow: {
			gap: spacing.xs,
			marginTop: spacing.md,
		},
		infoValue: {
			...typography.body,
			color: themeColors.textPrimary,
		},
		legendDot: {
			borderRadius: 6,
			height: 12,
			width: 12,
		},
		progressSegment: {
			height: "100%",
		},
		progressLabel: {
			...typography.caption,
			color: themeColors.textSecondary,
			marginTop: spacing.sm,
		},
		progressTrack: {
			backgroundColor: themeColors.border,
			borderRadius: 999,
			flexDirection: "row",
			height: 12,
			marginTop: spacing.md,
			overflow: "hidden",
		},
		sectionTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
	});
}
