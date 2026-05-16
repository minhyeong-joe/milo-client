import {
	BabyAvatarField,
	BabyBirthdateField,
	BabyNameField,
	BabySexSelector,
	formatBabyProfileDateKey,
} from "@/components/baby/BabyProfileFields";
import { useBabySelection } from "@/context/BabySelectionContext";
import type { BabySex } from "@/services/api/babies";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditBabyProfileScreen() {
	const router = useRouter();
	const {
		removeSelectedBabyAvatar,
		selectedBaby,
		setSelectedBabyAvatar,
		updateSelectedBabyProfile,
	} = useBabySelection();
	const [name, setName] = useState(selectedBaby?.name ?? "");
	const [birthdate, setBirthdate] = useState(() => new Date(`${selectedBaby?.birthdate ?? formatBabyProfileDateKey(new Date())}T00:00:00`));
	const [sex, setSex] = useState<BabySex>(selectedBaby?.sex ?? "BOY");
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setIsPickerOpen(false);
		}

		if (event.type === "dismissed" || !selectedDate) {
			return;
		}

		setBirthdate(selectedDate);
	};

	const saveProfile = async () => {
		if (!selectedBaby) {
			setFormError("Select a baby before editing profile.");
			return;
		}

		const trimmedName = name.trim();

		if (!trimmedName) {
			setFormError("Baby name is required.");
			return;
		}

		setIsSaving(true);
		setFormError(null);

		try {
			const didSave = await updateSelectedBabyProfile({
				birthdate: formatBabyProfileDateKey(birthdate),
				name: trimmedName,
				sex,
			});

			if (didSave) {
				router.back();
			} else {
				setFormError("Select a baby before editing profile.");
			}
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<View style={styles.header}>
					<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
					<Text style={globalStyles.sectionTitleText}>Edit Profile</Text>
					<View style={styles.headerButton} />
				</View>
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<BabyAvatarField
						avatarObjectKey={selectedBaby?.avatarObjectKey}
						avatarUrl={selectedBaby?.avatarUrl}
						babyId={selectedBaby?.id}
						disabled={isSaving}
						onAvatarRemoved={removeSelectedBabyAvatar}
						onAvatarSelected={setSelectedBabyAvatar}
					/>
					<BabyNameField
						label="Name"
						onChangeText={setName}
						placeholder="Baby name"
						value={name}
					/>
					<BabyBirthdateField
						isPickerVisible={isPickerOpen}
						onChange={handlePickerChange}
						onOpenPicker={() => setIsPickerOpen(true)}
						value={birthdate}
					/>
					<BabySexSelector onChange={setSex} value={sex} />
				</ScrollView>
				<View style={styles.footer}>
					{formError ? <Text style={styles.errorText}>{formError}</Text> : null}
					<Pressable
						accessibilityRole="button"
						disabled={isSaving}
						onPress={() => void saveProfile()}
						style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
					>
						<Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save Profile"}</Text>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not save baby profile. Please try again.";
}

const styles = StyleSheet.create({
	cancelText: {
		color: colors.light.primary,
		fontSize: 15,
		fontWeight: "700",
	},
	content: {
		gap: spacing.lg,
		padding: spacing.md,
	},
	errorText: {
		color: colors.light.error,
		fontSize: 13,
		fontWeight: "700",
		marginBottom: spacing.sm,
	},
	footer: {
		backgroundColor: colors.light.background,
		padding: spacing.md,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	headerButton: {
		minWidth: 72,
		paddingVertical: spacing.sm,
	},
	keyboardView: {
		flex: 1,
	},
	saveButton: {
		alignItems: "center",
		backgroundColor: colors.light.primary,
		borderRadius: 16,
		paddingVertical: 16,
	},
	saveButtonDisabled: {
		opacity: 0.5,
	},
	saveButtonText: {
		color: colors.light.surface,
		fontSize: 16,
		fontWeight: "800",
	},
});
