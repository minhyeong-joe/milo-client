import { SettingsHeader } from "@/components/settings/SettingsRows";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AppPreferencesScreen() {
	const router = useRouter();
	const {
		preferredLengthUnit,
		preferredSolidFoodUnit,
		preferredVolumeUnit,
		preferredWeightUnit,
		setPreferredLengthUnit,
		setPreferredSolidFoodUnit,
		setPreferredVolumeUnit,
		setPreferredWeightUnit,
	} = useAppPreferences();

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="App Preferences" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Unit Preference</Text>
					<PreferenceRow label="Volume">
						<SegmentButton
							active={preferredVolumeUnit === "ml"}
							label="mL"
							onPress={() => void setPreferredVolumeUnit("ml")}
						/>
						<SegmentButton
							active={preferredVolumeUnit === "oz"}
							label="oz"
							onPress={() => void setPreferredVolumeUnit("oz")}
						/>
					</PreferenceRow>
					<PreferenceRow label="Length">
						<SegmentButton
							active={preferredLengthUnit === "cm"}
							label="cm"
							onPress={() => void setPreferredLengthUnit("cm")}
						/>
						<SegmentButton
							active={preferredLengthUnit === "in"}
							label="in"
							onPress={() => void setPreferredLengthUnit("in")}
						/>
					</PreferenceRow>
					<PreferenceRow label="Weight">
						<SegmentButton
							active={preferredWeightUnit === "kg"}
							label="kg"
							onPress={() => void setPreferredWeightUnit("kg")}
						/>
						<SegmentButton
							active={preferredWeightUnit === "lb"}
							label="lb"
							onPress={() => void setPreferredWeightUnit("lb")}
						/>
					</PreferenceRow>
				</View>

				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>App Preference</Text>
					<PreferenceRow helper="Coming Soon" label="Theme">
						<DisabledPill label="Light" />
						<DisabledPill label="Dark" />
					</PreferenceRow>
					<PreferenceRow helper="Coming Soon" label="Language">
						<DisabledPill label="English" />
						<DisabledPill label="한국어" />
					</PreferenceRow>
					<View style={styles.disabledRow}>
						<Text style={styles.label}>Timeline timezone</Text>
						<Text style={styles.valueText}>
							Device default • {Intl.DateTimeFormat().resolvedOptions().timeZone}
						</Text>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

function PreferenceRow({
	children,
	helper,
	label,
}: {
	children: ReactNode;
	helper?: string;
	label: string;
}) {
	return (
		<View style={styles.preferenceRow}>
			<View style={styles.preferenceText}>
				<Text style={styles.label}>{label}</Text>
				{helper ? <Text style={styles.helper}>{helper}</Text> : null}
			</View>
			<View style={styles.segmentedControl}>{children}</View>
		</View>
	);
}

function SegmentButton({
	active,
	label,
	onPress,
}: {
	active: boolean;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			onPress={onPress}
			style={[styles.segmentButton, active && styles.segmentButtonActive]}
		>
			<Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
		</Pressable>
	);
}

function DisabledPill({ label }: { label: string }) {
	return (
		<View style={[styles.segmentButton, styles.disabledPill]}>
			<Text style={styles.disabledPillText}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		padding: spacing.md,
		paddingBottom: spacing.xl,
	},
	disabledPill: {
		opacity: 0.55,
	},
	disabledPillText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontWeight: "800",
	},
	disabledRow: {
		gap: spacing.xs,
		marginTop: spacing.md,
	},
	helper: {
		...typography.caption,
		color: colors.light.textSecondary,
		marginTop: 2,
	},
	label: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	preferenceRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.md,
		marginTop: spacing.md,
	},
	preferenceText: {
		flex: 1,
	},
	sectionTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
	},
	segmentButton: {
		alignItems: "center",
		borderRadius: 10,
		flex: 1,
		justifyContent: "center",
		minHeight: 38,
		paddingHorizontal: spacing.sm,
	},
	segmentButtonActive: {
		backgroundColor: colors.light.primary,
	},
	segmentedControl: {
		backgroundColor: colors.light.background,
		borderColor: colors.light.border,
		borderRadius: 13,
		borderWidth: 1,
		flexDirection: "row",
		minWidth: 144,
		padding: 3,
	},
	segmentText: {
		...typography.caption,
		color: colors.light.textSecondary,
		fontWeight: "800",
	},
	segmentTextActive: {
		color: colors.light.surface,
	},
	valueText: {
		...typography.body,
		color: colors.light.textSecondary,
	},
});
