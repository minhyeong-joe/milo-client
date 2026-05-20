import { SettingsHeader } from "@/components/settings/SettingsRows";
import { TimeZoneSelector } from "@/components/settings/TimeZoneSelector";
import { useAppPreferences, useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { getDeviceTimeZone } from "@/utils/timeZones";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function BabyTimeZoneScreen() {
	const router = useRouter();
	const { globalStyles, styles, themeColors } = useThemeStyles();
	const { displayTimeZonePreference, setDisplayTimeZonePreference } =
		useAppPreferences();
	const { selectedBaby, updateSelectedBabyProfile } = useBabySelection();
	const isOwnerCapable =
		selectedBaby?.role === "FATHER" || selectedBaby?.role === "MOTHER";
	const selectedBabyTimeZone = selectedBaby?.timezone ?? getDeviceTimeZone();

	const handleBabyTimeZoneChange = async (timeZone: string) => {
		if (!selectedBaby || !isOwnerCapable) {
			return;
		}

		const didUpdate = await updateSelectedBabyProfile({
			birthdate: selectedBaby.birthdate,
			name: selectedBaby.name,
			sex: selectedBaby.sex,
			timezone: timeZone,
		});

		if (!didUpdate || displayTimeZonePreference === null) {
			return;
		}

		Alert.alert(
			"Update display timezone?",
			`Use ${selectedBaby.name}'s timezone for times shown on this device too?`,
			[
				{ style: "cancel", text: "No" },
				{
					onPress: () => void setDisplayTimeZonePreference(null),
					text: "Yes",
				},
			],
		);
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Baby Timezone" />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>
						{selectedBaby ? `${selectedBaby.name}'s timezone` : "Baby Timezone"}
					</Text>
					<Text style={styles.helper}>
						Used for trackers, reports, and diaries. This updates all caregivers
					</Text>
					<TimeZoneSelector
						disabled={!selectedBaby || !isOwnerCapable}
						label="Timezone"
						onChange={(timeZone) => void handleBabyTimeZoneChange(timeZone)}
						timeZone={selectedBabyTimeZone}
					/>
					{selectedBaby && !isOwnerCapable ? (
						<Text style={styles.ownerOnlyText}>
							Only the baby owner can change this shared setting.
						</Text>
					) : null}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		content: {
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		helper: {
			...typography.caption,
			color: themeColors.textSecondary,
			lineHeight: 18,
			marginTop: spacing.xs,
		},
		ownerOnlyText: {
			...typography.caption,
			color: themeColors.textSecondary,
			lineHeight: 18,
			marginTop: spacing.md,
		},
		sectionTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
	});
}
