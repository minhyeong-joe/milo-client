import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { SettingsHeader } from "@/components/settings/SettingsRows";
import { TimeZoneSelector } from "@/components/settings/TimeZoneSelector";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { spacing, type ThemeColors, typography } from "@/styles/globalStyles";
import { getDeviceTimeZone } from "@/utils/timeZones";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PreferencesStyles = ReturnType<typeof createStyles>;

export default function AppPreferencesScreen() {
	const router = useRouter();
	const {
		globalStyles,
		preferredLengthUnit,
		preferredVolumeUnit,
		preferredWeightUnit,
		setPreferredLengthUnit,
		setPreferredVolumeUnit,
		setPreferredWeightUnit,
		setThemePreference,
		setLanguagePreference,
		themeColors,
		themePreference,
		languagePreference,
	} = useAppPreferences();
	const { selectedBaby, updateSelectedBabyProfile } = useBabySelection();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);
	const selectedBabyTimeZone = selectedBaby?.timezone ?? getDeviceTimeZone();

	const handleBabyTimeZoneChange = async (timeZone: string) => {
		if (!selectedBaby) {
			return;
		}

		await updateSelectedBabyProfile({
			birthdate: selectedBaby.birthdate,
			name: selectedBaby.name,
			sex: selectedBaby.sex,
			timezone: timeZone,
		});
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="App Preferences" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Unit Preference</Text>
					<PreferenceRow label="Volume" styles={styles} helper="Bottle">
						<SegmentButton
							active={preferredVolumeUnit === "ml"}
							label="mL"
							onPress={() => void setPreferredVolumeUnit("ml")}
							styles={styles}
						/>
						<SegmentButton
							active={preferredVolumeUnit === "oz"}
							label="oz"
							onPress={() => void setPreferredVolumeUnit("oz")}
							styles={styles}
						/>
					</PreferenceRow>
					<PreferenceRow label="Length" styles={styles} helper="Height, Head size">
						<SegmentButton
							active={preferredLengthUnit === "cm"}
							label="cm"
							onPress={() => void setPreferredLengthUnit("cm")}
							styles={styles}
						/>
						<SegmentButton
							active={preferredLengthUnit === "in"}
							label="in"
							onPress={() => void setPreferredLengthUnit("in")}
							styles={styles}
						/>
					</PreferenceRow>
					<PreferenceRow label="Weight" styles={styles} helper="Weight">
						<SegmentButton
							active={preferredWeightUnit === "kg"}
							label="kg"
							onPress={() => void setPreferredWeightUnit("kg")}
							styles={styles}
						/>
						<SegmentButton
							active={preferredWeightUnit === "lb"}
							label="lb"
							onPress={() => void setPreferredWeightUnit("lb")}
							styles={styles}
						/>
					</PreferenceRow>
				</View>

				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>App Preference</Text>
					<PreferenceRow
						helper="Choose app appearance"
						label="Theme"
						styles={styles}
					>
						<SegmentButton
							active={themePreference === "system"}
							label="System"
							onPress={() => void setThemePreference("system")}
							styles={styles}
						/>
						<SegmentButton
							active={themePreference === "light"}
							label="Light"
							onPress={() => void setThemePreference("light")}
							styles={styles}
						/>
						<SegmentButton
							active={themePreference === "dark"}
							label="Dark"
							onPress={() => void setThemePreference("dark")}
							styles={styles}
						/>
					</PreferenceRow>
					<LanguageSelector
						label="Language"
						language={languagePreference}
						onChange={(language) => void setLanguagePreference(language)}
					/>
					<TimeZoneSelector
						disabled={!selectedBaby}
						label="Timezone"
						onChange={(timeZone) => void handleBabyTimeZoneChange(timeZone)}
						timeZone={selectedBabyTimeZone}
					/>
					<Text style={styles.timeZoneHelper}>
						{selectedBaby
							? "Used for routine, diary, and reports for this baby."
							: "Select a baby before changing timezone."}
					</Text>
					<Text style={{...styles.timeZoneHelper, color: themeColors.error}}>
						<Ionicons name="warning-outline" size={12} />
						This changes timezone for all caregivers for this baby
					</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

function PreferenceRow({
	children,
	helper,
	label,
	styles,
}: {
	children: ReactNode;
	helper?: string;
	label: string;
	styles: PreferencesStyles;
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
	styles,
}: {
	active: boolean;
	label: string;
	onPress: () => void;
	styles: PreferencesStyles;
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

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		helper: {
			...typography.caption,
			color: themeColors.textSecondary,
			marginTop: 2,
		},
		label: {
			...typography.label,
			color: themeColors.textPrimary,
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
			color: themeColors.textPrimary,
		},
		timeZoneHelper: {
			...typography.caption,
			color: themeColors.textSecondary,
			marginTop: spacing.md,
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
			backgroundColor: themeColors.primary,
		},
		segmentedControl: {
			backgroundColor: themeColors.background,
			borderColor: themeColors.border,
			borderRadius: 13,
			borderWidth: 1,
			flexDirection: "row",
			minWidth: 180,
			padding: 3,
		},
		segmentText: {
			...typography.caption,
			color: themeColors.textSecondary,
			fontWeight: "800",
		},
		segmentTextActive: {
			color: "#FFFFFF",
		},
	});
}
