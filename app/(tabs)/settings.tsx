import { BabySelectorModal } from "@/components/baby/BabySelectorModal";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsRows";
import { useBabySelection } from "@/context/BabySelectionContext";
import { FEATURE_VISUALS } from "@/constants/featureVisuals";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import {
	useAppPreferences,
	useAppTheme,
} from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import {
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const fallbackBabyAvatar = require("@/assets/images/baby.png");

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function SettingsScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { languagePreference } = useAppPreferences();
	const { babies, selectBaby, selectedBaby } = useBabySelection();
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	const isOwnerCapable =
		selectedBaby?.role === "FATHER" || selectedBaby?.role === "MOTHER";

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={globalStyles.sectionTitleText}>Settings</Text>

				<View style={styles.babySettingsGroup}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Select baby"
						onPress={() => setIsSelectorOpen(true)}
						style={({ pressed }) => [
							styles.profileCard,
							pressed && styles.pressed,
						]}
					>
						<Image
							source={
								selectedBaby?.avatarUrl
									? { uri: selectedBaby.avatarUrl }
									: fallbackBabyAvatar
							}
							style={styles.avatar}
						/>
						<View style={styles.profileText}>
							<Text style={styles.babyName}>
								{selectedBaby?.name ?? "Baby Profile"}
							</Text>
							<Text style={styles.profileSubtitle}>
								{selectedBaby
									? `Born ${formatBirthdate(selectedBaby.birthdate, selectedBaby.timezone, languagePreference)}\n${formatAge(selectedBaby.birthdate)} old`
									: "Create or choose a baby profile"}
							</Text>
						</View>
						<Ionicons
							color={themeColors.textSecondary}
							name="chevron-down"
							size={22}
						/>
					</Pressable>
					<SettingsRow
						disabled={!!selectedBaby && !isOwnerCapable}
						icon="create-outline"
						iconBackground="#F1ECFF"
						iconColor={themeColors.primary}
						onPress={() => router.push("/baby/edit-profile")}
						subtitle={
							isOwnerCapable || !selectedBaby
								? "Name, birthday, photo"
								: "Owner only"
						}
						title="Edit Baby Profile"
					/>
					<SettingsRow
						disabled={!!selectedBaby && !isOwnerCapable}
						icon="time-outline"
						iconBackground="#F1ECFF"
						iconColor={themeColors.primary}
						onPress={() => router.push("/settings/baby-timezone")}
						subtitle={`${selectedBaby?.timezone} ${
							isOwnerCapable || !selectedBaby ? "" : " (Owner only)"
						}`}
						title="Baby Timezone"
					/>
					<SettingsRow
						disabled={!!selectedBaby && !isOwnerCapable}
						icon="people-outline"
						iconBackground="#EAF8EF"
						iconColor="#2FAE62"
						onPress={() => router.push("/settings/caregivers")}
						subtitle={
							isOwnerCapable || !selectedBaby
								? "Access and invitations"
								: "Owner only"
						}
						title="Manage Caregivers"
					/>
					<SettingsRow
						icon={FEATURE_VISUALS.growth.icon}
						iconBackground={FEATURE_VISUALS.growth.backgroundColor}
						iconColor={FEATURE_VISUALS.growth.accentColor}
						onPress={() => router.push("/baby/growth")}
						subtitle="Height, Weight, Head Size"
						title="Growth Records"
					/>
					<SettingsRow
						icon={FEATURE_VISUALS.immunization.icon}
						iconBackground={FEATURE_VISUALS.immunization.backgroundColor}
						iconColor={FEATURE_VISUALS.immunization.accentColor}
						onPress={() => router.push("/baby/immunization")}
						subtitle="Keep track of immunization schedule"
						title="Immunization Records"
					/>
					<SettingsRow
						icon="pricetag-outline"
						iconBackground="#FFEAF4"
						iconColor="#D84D8B"
						onPress={() => router.push("/settings/tags")}
						subtitle="View and manage diary tags"
						title="Diary Tags"
					/>
					<SettingsRow
						icon="cloud-outline"
						onPress={() => router.push("/settings/storage-usage")}
						subtitle="1.2 GB of 5 GB used"
						title="Storage Usage"
					/>
				</View>

				<SettingsGroup>
					<SettingsRow
						icon="settings-outline"
						iconBackground="#EAF4FF"
						iconColor="#2563EB"
						onPress={() => router.push("/settings/preferences")}
						subtitle="Units, Language, Theme"
						title="App Preferences"
					/>
					<SettingsRow
						icon="person-outline"
						iconBackground="#EAF8EF"
						iconColor="#2FAE62"
						onPress={() => router.push("/settings/account")}
						subtitle="Email, Password, Security"
						title="Account"
					/>
				</SettingsGroup>
				<BabySelectorModal
					babies={babies}
					onClose={() => setIsSelectorOpen(false)}
					onSelectBaby={selectBaby}
					selectedBaby={selectedBaby}
					visible={isSelectorOpen}
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

function formatBirthdate(dateKey: string, timeZone?: string, locale = "en-US") {
	const date = new Date(`${dateKey}T00:00:00`);
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(date);
}

function formatAge(dateKey: string) {
	const birthdate = new Date(`${dateKey}T00:00:00`);
	const today = new Date();
	let months = (today.getFullYear() - birthdate.getFullYear()) * 12;
	months += today.getMonth() - birthdate.getMonth();

	if (today.getDate() < birthdate.getDate()) {
		months -= 1;
	}

	const monthAnchor = new Date(birthdate);
	monthAnchor.setMonth(birthdate.getMonth() + Math.max(months, 0));
	const days = Math.max(
		0,
		Math.floor((today.getTime() - monthAnchor.getTime()) / 86400000),
	);

	if (months <= 0) {
		return `${days} days`;
	}

	return `${months} months • ${days} days`;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		avatar: {
			backgroundColor: "#D9BFAE",
			borderRadius: 28,
			height: 56,
			width: 56,
		},
		babyName: {
			...typography.label,
			color: themeColors.textPrimary,
		},
		babySettingsGroup: {
			backgroundColor: themeColors.surface,
			borderColor: themeColors.border,
			borderRadius: 16,
			borderWidth: 1,
			overflow: "hidden",
		},
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		pressed: {
			opacity: 0.72,
		},
		profileCard: {
			alignItems: "center",
			borderBottomColor: themeColors.border,
			borderBottomWidth: StyleSheet.hairlineWidth,
			flexDirection: "row",
			gap: spacing.md,
			padding: spacing.md,
		},
		profileSubtitle: {
			...typography.caption,
			color: themeColors.textSecondary,
			lineHeight: 18,
			marginTop: 3,
		},
		profileText: {
			flex: 1,
		},
	});
}
