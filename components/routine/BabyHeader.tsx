import type { BabyListItem } from "@/services/api/babies";
import { colors, spacing, globalStyles } from "@/styles/globalStyles";
import { formatBabyAge } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Alert,
	FlatList,
	Image,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

const fallbackBabyAvatar = require("@/assets/images/baby.png");

function BabyAvatar({ baby }: { baby: BabyListItem }) {
	const avatarUri = getBabyAvatarUri(baby.avatarObjectKey);

	return (
		<Image
			source={avatarUri ? { uri: avatarUri } : fallbackBabyAvatar}
			style={styles.avatar}
		/>
	);
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
	const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
	const currentDate = new Date();

	const handleSelectBaby = (babyId: string) => {
		onSelectBaby(babyId);
		setIsSelectorOpen(false);
	};

	const onImagePress = () => {
		Alert.alert(
			"Change profile picture",
			"TODO: Implement profile picture change flow"
		);
	}

	return (
		<View style={[globalStyles.rowBetween, styles.header]}>
			<View style={[globalStyles.rowCenter, styles.profileRow]}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Open baby profile actions"
					onPress={() => setIsProfileModalOpen(true)}
				>
					<BabyAvatar baby={baby} />
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
								color={colors.light.textPrimary}
								name="chevron-down"
								size={18}
							/>
						</View>
						<Text style={styles.babyAge}>{ageLabel}</Text>
					</Pressable>
				</View>
			</View>
			<View style={[globalStyles.rowCenter, styles.headerActions]}>
				<Ionicons
					color={colors.light.textPrimary}
					name="notifications-outline"
					size={25}
				/>
				<Ionicons
					color={colors.light.textPrimary}
					name="calendar-outline"
					size={25}
				/>
			</View>
			<Modal
				animationType="fade"
				onRequestClose={() => setIsSelectorOpen(false)}
				transparent
				visible={isSelectorOpen}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => setIsSelectorOpen(false)}
					style={styles.modalBackdrop}
				>
					<Pressable style={[globalStyles.shadowCard, styles.selectorPanel]}>
						<Text style={styles.selectorTitle}>Select baby</Text>
						<FlatList
							data={babies}
							keyExtractor={(item) => item.id}
							renderItem={({ item }) => {
								const isSelected = item.id === baby.id;

								return (
									<Pressable
										accessibilityRole="button"
										onPress={() => handleSelectBaby(item.id)}
										style={[
											styles.selectorItem,
											isSelected && styles.selectorItemSelected,
										]}
									>
										<View style={[globalStyles.rowCenter, styles.profileRow]}>
											<BabyAvatar baby={item} />
											<View>
												<Text style={styles.selectorName}>{item.name}</Text>
												<Text style={styles.selectorAge}>
													{formatBabyAge(item.birthdate, currentDate)}
												</Text>
											</View>
										</View>
										{isSelected && (
											<Ionicons
												color={colors.light.primary}
												name="checkmark"
												size={22}
											/>
										)}
									</Pressable>
								);
							}}
						/>
					</Pressable>
				</Pressable>
			</Modal>
			<Modal
				animationType="fade"
				onRequestClose={() => setIsProfileModalOpen(false)}
				transparent
				visible={isProfileModalOpen}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => setIsProfileModalOpen(false)}
					style={styles.profileModalBackdrop}
				>
					<Pressable style={[globalStyles.shadowCard, styles.profilePanel]}>
						<Pressable
							accessibilityRole="button"
							onPress={onImagePress}
							style={styles.largeAvatarButton}
						>
							<Image
								source={getBabyAvatarUri(baby.avatarObjectKey) ? { uri: getBabyAvatarUri(baby.avatarObjectKey) } : fallbackBabyAvatar}
								style={styles.largeAvatar}
							/>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								setIsProfileModalOpen(false);
								router.push("/baby/edit-profile");
							}}
							style={styles.profileActionButton}
						>
							<Text style={styles.profileActionText}>Edit Profile</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								setIsProfileModalOpen(false);
								router.push("/baby/add-measurement");
							}}
							style={styles.profileActionButton}
						>
							<Text style={styles.profileActionText}>Add Measurement</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</View>
	);
}

function getBabyAvatarUri(avatarObjectKey: string | null) {
	const bucketUrl = process.env.EXPO_PUBLIC_S3_BUCKET_URL;

	if (!avatarObjectKey || !bucketUrl) {
		return null;
	}

	return `${trimTrailingSlashes(bucketUrl)}/${trimLeadingSlashes(avatarObjectKey)}`;
}

function trimTrailingSlashes(value: string) {
	return value.replace(/\/+$/, "");
}

function trimLeadingSlashes(value: string) {
	return value.replace(/^\/+/, "");
}

const styles = StyleSheet.create({
	avatar: {
		alignItems: "center",
		backgroundColor: "#D9BFAE",
		borderRadius: 28,
		height: 56,
		justifyContent: "center",
		overflow: "hidden",
		width: 56,
	},
	babyAge: {
		color: colors.light.textSecondary,
		fontSize: 15,
		fontWeight: "600",
		marginTop: 2,
	},
	babyName: {
		color: colors.light.textPrimary,
		fontSize: 24,
		fontWeight: "800",
	},
	header: {
		marginBottom: spacing.md,
	},
	headerActions: {
		gap: spacing.lg,
	},
	nameRow: {
		gap: spacing.xs,
	},
	profileRow: {
		gap: spacing.md,
	},
	largeAvatar: {
		borderRadius: 72,
		height: 144,
		width: 144,
	},
	largeAvatarButton: {
		alignItems: "center",
		gap: spacing.sm,
	},
	modalBackdrop: {
		backgroundColor: "rgba(21, 24, 39, 0.22)",
		flex: 1,
		justifyContent: "flex-start",
		paddingHorizontal: spacing.md,
		paddingTop: 92,
	},
	selectorItem: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	selectorItemSelected: {
		backgroundColor: "#F1EEFF",
	},
	selectorMeta: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "700",
		marginTop: 2,
	},
	selectorAge: {
		color: colors.light.textSecondary,
		fontSize: 13,
		fontWeight: "600",
		marginTop: 2,
	},
	selectorName: {
		color: colors.light.textPrimary,
		fontSize: 16,
		fontWeight: "800",
	},
	selectorPanel: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 8,
		borderWidth: 1,
		maxHeight: 320,
		padding: spacing.sm,
	},
	selectorTitle: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "800",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		textTransform: "uppercase",
	},
	profileActionButton: {
		alignItems: "center",
		backgroundColor: colors.light.primary,
		borderRadius: 12,
		paddingVertical: 14,
		width: "100%",
	},
	profileActionText: {
		color: colors.light.surface,
		fontSize: 15,
		fontWeight: "800",
	},
	profileModalBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.32)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	profilePanel: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 16,
		borderWidth: 1,
		gap: spacing.md,
		padding: spacing.lg,
		width: "100%",
	},
	uploadHint: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "700",
	},
});
