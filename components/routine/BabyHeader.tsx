import { BabySelectorAvatar, BabySelectorModal } from "@/components/baby/BabySelectorModal";
import type { BabyListItem } from "@/services/api/babies";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export function BabyHeader({
	ageLabel,
	babies,
	baby,
	onSelectBaby,
}: {
	ageLabel: string;
	babies: BabyListItem[];
	baby: BabyListItem;
	onSelectBaby: (babyId: string) => void;
}) {
	const router = useRouter();
	const [isSelectorOpen, setIsSelectorOpen] = useState(false);
	const { globalStyles, themeColors, styles } = useThemeStyles();

	return (
		<View style={[globalStyles.rowBetween, styles.header]}>
			<View style={[globalStyles.rowCenter, styles.profileRow]}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Open baby profile actions"
					onPress={() => {
						router.push("/baby/edit-profile");
					}}
				>
					<BabySelectorAvatar baby={baby} />
				</Pressable>
				<View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Select baby"
						onPress={() => setIsSelectorOpen(true)}
					>
						<View style={[globalStyles.rowCenter, styles.nameRow]}>
							<Text style={styles.babyName}>{baby.name}</Text>
							<Ionicons
								color={themeColors.textPrimary}
								name="chevron-down"
								size={18}
							/>
						</View>
						<Text style={styles.babyAge}>{ageLabel}</Text>
					</Pressable>
				</View>
			</View>
			<BabySelectorModal
				babies={babies}
				onClose={() => setIsSelectorOpen(false)}
				onSelectBaby={onSelectBaby}
				selectedBaby={baby}
				visible={isSelectorOpen}
			/>
		</View>
	);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	babyAge: {
		color: themeColors.textSecondary,
		fontSize: 15,
		fontWeight: "600",
		marginTop: 2,
	},
	babyName: {
		color: themeColors.textPrimary,
		fontSize: 24,
		fontWeight: "800",
	},
	header: {
		marginBottom: spacing.md,
	},
	nameRow: {
		gap: spacing.xs,
	},
	profileRow: {
		gap: spacing.md,
	},
});
}
