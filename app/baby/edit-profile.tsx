import {
	BabyAvatarField,
	BabyBirthdateField,
	BabyNameField,
	BabySexSelector,
	formatBabyProfileDateKey,
} from "@/components/baby/BabyProfileFields";
import { useBabySelection } from "@/context/BabySelectionContext";
import type { BabySex, CreateBabyAvatarUploadRequest } from "@/services/api/babies";
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

type AvatarDraft =
	| { status: "unchanged" }
	| { status: "replace"; contentType: CreateBabyAvatarUploadRequest["contentType"]; localUri: string }
	| { status: "delete" };

type InitialBabyProfile = {
	avatarObjectKey: string | null;
	avatarUrl: string | null;
	birthdate: string;
	id: string;
	name: string;
	sex: BabySex;
};

export default function EditBabyProfileScreen() {
	const router = useRouter();
	const {
		saveSelectedBabyProfileDraft,
		selectedBaby,
	} = useBabySelection();
	const [initialProfile] = useState<InitialBabyProfile | null>(() =>
		selectedBaby
			? {
					avatarObjectKey: selectedBaby.avatarObjectKey,
					avatarUrl: selectedBaby.avatarUrl,
					birthdate: selectedBaby.birthdate,
					id: selectedBaby.id,
					name: selectedBaby.name,
					sex: selectedBaby.sex,
				}
			: null,
	);
	const [name, setName] = useState(initialProfile?.name ?? "");
	const [birthdate, setBirthdate] = useState(() => new Date(`${initialProfile?.birthdate ?? formatBabyProfileDateKey(new Date())}T00:00:00`));
	const [sex, setSex] = useState<BabySex>(initialProfile?.sex ?? "BOY");
	const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>({ status: "unchanged" });
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const avatarPreview = getAvatarPreview(initialProfile, avatarDraft);

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
		if (!initialProfile) {
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
			const didSave = await saveSelectedBabyProfileDraft(
				{
					birthdate: formatBabyProfileDateKey(birthdate),
					name: trimmedName,
					sex,
				},
				avatarDraft,
			);

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

	const cancelEdit = () => {
		setName(initialProfile?.name ?? "");
		setBirthdate(new Date(`${initialProfile?.birthdate ?? formatBabyProfileDateKey(new Date())}T00:00:00`));
		setSex(initialProfile?.sex ?? "BOY");
		setAvatarDraft({ status: "unchanged" });
		setFormError(null);
		router.back();
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.keyboardView}
			>
				<View style={styles.header}>
					<Pressable accessibilityRole="button" onPress={cancelEdit} style={styles.headerButton}>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
					<Text style={globalStyles.sectionTitleText}>Edit Profile</Text>
					<View style={styles.headerButton} />
				</View>
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<BabyAvatarField
						avatarObjectKey={avatarPreview.avatarObjectKey}
						avatarUrl={avatarPreview.avatarUrl}
						babyId={initialProfile?.id}
						disabled={isSaving}
						onAvatarRemoved={() =>
							setAvatarDraft(initialProfile?.avatarObjectKey ? { status: "delete" } : { status: "unchanged" })
						}
						onAvatarSelected={({ contentType, localUri }) =>
							setAvatarDraft({ contentType, localUri, status: "replace" })
						}
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

function getAvatarPreview(
	initialProfile: InitialBabyProfile | null,
	avatarDraft: AvatarDraft,
) {
	if (avatarDraft.status === "replace") {
		return {
			avatarObjectKey: "local:avatar",
			avatarUrl: avatarDraft.localUri,
		};
	}

	if (avatarDraft.status === "delete") {
		return {
			avatarObjectKey: null,
			avatarUrl: null,
		};
	}

	return {
		avatarObjectKey: initialProfile?.avatarObjectKey,
		avatarUrl: initialProfile?.avatarUrl,
	};
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
