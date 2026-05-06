import { useBabySelection } from "@/context/BabySelectionContext";
import type { BabySex } from "@/services/api/babies";
import { updateBaby } from "@/services/api/babies";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const sexOptions: { label: string; value: BabySex }[] = [
	{ label: "Girl", value: "GIRL" },
	{ label: "Boy", value: "BOY" },
];

export default function EditBabyProfileScreen() {
	const router = useRouter();
	const { refreshBabies, selectedBaby } = useBabySelection();
	const [name, setName] = useState(selectedBaby?.name ?? "");
	const [birthdate, setBirthdate] = useState(() => new Date(`${selectedBaby?.birthdate ?? getDateKey(new Date())}T00:00:00`));
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
			await updateBaby(selectedBaby.id, {
				birthdate: getDateKey(birthdate),
				name: trimmedName,
				sex,
			});
			await refreshBabies();
			router.back();
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
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Name</Text>
						<TextInput
							onChangeText={setName}
							placeholder="Baby name"
							placeholderTextColor={colors.light.textSecondary}
							style={styles.input}
							value={name}
						/>
					</View>
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Birth date</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => setIsPickerOpen(true)}
							style={styles.dateField}
						>
							<Ionicons color={colors.light.textSecondary} name="calendar-outline" size={20} />
							<Text style={styles.dateText}>{formatDate(birthdate)}</Text>
						</Pressable>
						{isPickerOpen ? (
							<DateTimePicker
								display={Platform.OS === "ios" ? "spinner" : "default"}
								mode="date"
								onChange={handlePickerChange}
								value={birthdate}
							/>
						) : null}
					</View>
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Gender</Text>
						<View style={styles.segmentRow}>
							{sexOptions.map((option) => {
								const isSelected = option.value === sex;
								return (
									<Pressable
										accessibilityRole="button"
										key={option.value}
										onPress={() => setSex(option.value)}
										style={[styles.segmentButton, isSelected && styles.segmentButtonSelected]}
									>
										<Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
											{option.label}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>
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

function getDateKey(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(value);
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
	dateField: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	dateText: {
		color: colors.light.textPrimary,
		fontSize: 16,
		fontWeight: "800",
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
	input: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		color: colors.light.textPrimary,
		fontSize: 16,
		fontWeight: "700",
		padding: spacing.md,
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
	section: {
		gap: spacing.sm,
	},
	sectionLabel: {
		color: colors.light.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
	segmentButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flex: 1,
		paddingVertical: 14,
	},
	segmentButtonSelected: {
		backgroundColor: "#F1EEFF",
		borderColor: colors.light.primary,
	},
	segmentRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	segmentText: {
		color: colors.light.textPrimary,
		fontSize: 14,
		fontWeight: "800",
	},
	segmentTextSelected: {
		color: colors.light.primary,
	},
});
