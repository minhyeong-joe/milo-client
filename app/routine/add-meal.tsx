import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import type { MealEvent, MealType } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { useRoutineData } from "@/context/RoutineDataContext";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { formatClockTime } from "@/utils/routineDisplay";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { RoutineIcon } from "@/components/routine/RoutineIcon";

const BOTTLE_STEP_ML = 10;
const DURATION_STEP_MINUTES = 5;
const NOTES_LIMIT = 100;

const mealTypes: MealType[] = ["breastfeed", "breastMilk", "formula", "solid"];
const bowlOptions = [
	{ label: "1/4", value: 0.25 },
	{ label: "1/2", value: 0.5 },
	{ label: "3/4", value: 0.75 },
	{ label: "1 bowl", value: 1 },
];

function isBottleMeal(type: MealType) {
	return type === "breastMilk" || type === "formula";
}

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(value);
}

export default function AddMealScreen() {
	const router = useRouter();
	const { mealId } = useLocalSearchParams<{ mealId?: string }>();
	const { addMeal, dailyLogs, getLatestMeal, updateMeal, removeMeal } = useRoutineData();
	const mealToEdit = dailyLogs
	.flatMap((day) => day.timeline)
	.find(
		(event): event is MealEvent =>
			event.kind === "meal" && event.id === mealId,
	);
	const latestMeal = getLatestMeal();
	const [mealTime, setMealTime] = useState(() => new Date(mealToEdit?.time ?? Date.now()));
	const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);
	const [mealType, setMealType] = useState<MealType>(mealToEdit?.type?? latestMeal?.type ?? "formula");
	const [amountMl, setAmountMl] = useState(mealToEdit?.amountMl ?? latestMeal?.amountMl ?? 60);
	const [durationMinutes, setDurationMinutes] = useState(mealToEdit?.durationMinutes ?? latestMeal?.durationMinutes ?? 15);
	const [amountBowl, setAmountBowl] = useState(mealToEdit?.amountBowl ?? latestMeal?.amountBowl ?? 0.5);
	const [notes, setNotes] = useState(mealToEdit?.notes ?? "");
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const decrementBottle = () => setAmountMl((value) => Math.max(BOTTLE_STEP_ML, value - BOTTLE_STEP_ML));
	const incrementBottle = () => setAmountMl((value) => value + BOTTLE_STEP_ML);
	const decrementDuration = () =>
		setDurationMinutes((value) => Math.max(DURATION_STEP_MINUTES, value - DURATION_STEP_MINUTES));
	const incrementDuration = () => setDurationMinutes((value) => value + DURATION_STEP_MINUTES);

	const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setActivePicker(null);
		}

		if (event.type === "dismissed" || !selectedDate) {
			return;
		}

		setMealTime(selectedDate);
	};

	const saveMeal = async () => {
		setIsSaving(true);
		setFormError(null);
		const input = {
			amountBowl: mealType === "solid" ? amountBowl : undefined,
			amountMl: isBottleMeal(mealType) ? amountMl : undefined,
			durationMinutes: mealType === "breastfeed" ? durationMinutes : undefined,
			notes,
			time: mealTime.toISOString(),
			type: mealType,
		};

		try {
			const didSave = mealToEdit
				? await updateMeal({ ...input, id: mealToEdit.id })
				: await addMeal(input);

			if (didSave) {
				router.back();
			} else {
				setFormError("Select a baby before saving this meal.");
			}
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	const deleteMeal = async () => {
		if (!mealToEdit) return;

		setIsSaving(true);
		setFormError(null);

		try {
			const didDelete = await removeMeal(mealToEdit.id);

			if (didDelete) {
				setIsDeleteModalVisible(false);
				router.back();
			} else {
				setFormError("Select a baby before deleting this meal.");
			}
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	}

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
					<View style={styles.headerTitle}>
						<RoutineIcon style={routineConfig.quickActions["meal"]} size={30} />
						<Text style={globalStyles.sectionTitleText}>Meal</Text>
					</View>
					{mealToEdit? (
						<Pressable
							accessibilityRole="button"
							disabled={isSaving}
							onPress={() => setIsDeleteModalVisible(true)}
							style={styles.headerButton}
						>
							<Ionicons name="trash-outline" size={24} style={styles.deleteIcon} />
						</Pressable>
					): (<View style={styles.headerSpacer} />)}
				</View>

				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Date & Time</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => setActivePicker("date")}
							style={styles.dateTimeField}
						>
							<Ionicons color={colors.light.textSecondary} name="calendar-outline" size={20} />
							<View>
								<Text style={styles.dateTimeValue}>{formatDate(mealTime)}</Text>
								<Text style={styles.dateTimeHint}>Date</Text>
							</View>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => setActivePicker("time")}
							style={styles.dateTimeField}
						>
							<Ionicons color={colors.light.textSecondary} name="time-outline" size={20} />
							<View>
								<Text style={styles.dateTimeValue}>{formatClockTime(mealTime.toISOString())}</Text>
								<Text style={styles.dateTimeHint}>Time</Text>
							</View>
						</Pressable>
						{activePicker ? (
							<DateTimePicker
								display={Platform.OS === "ios" ? "spinner" : "default"}
								mode={activePicker}
								onChange={handlePickerChange}
								value={mealTime}
							/>
						) : null}
					</View>

					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Type</Text>
						<View style={styles.segmentGrid}>
							{mealTypes.map((type) => {
								const isSelected = mealType === type;

								return (
									<Pressable
										accessibilityRole="button"
										key={type}
										onPress={() => setMealType(type)}
										style={[styles.segmentButton, isSelected && styles.segmentButtonSelected]}
									>
										<Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
											{routineConfig.mealTypes[type]}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>

					{mealType === "breastfeed" ? (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>Duration</Text>
							<View style={styles.stepperRow}>
								<StepperButton icon="remove" onPress={decrementDuration} />
								<Text style={styles.stepperValue}>{durationMinutes} min</Text>
								<StepperButton icon="add" onPress={incrementDuration} />
							</View>
						</View>
					) : null}

					{isBottleMeal(mealType) ? (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>Amount</Text>
							<View style={styles.stepperRow}>
								<StepperButton icon="remove" onPress={decrementBottle} />
								<Text style={styles.stepperValue}>{amountMl} ml</Text>
								<StepperButton icon="add" onPress={incrementBottle} />
							</View>
						</View>
					) : null}

					{mealType === "solid" ? (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>Bowl</Text>
							<View style={styles.bowlGrid}>
								{bowlOptions.map((option) => {
									const isSelected = amountBowl === option.value;

									return (
										<Pressable
											accessibilityRole="button"
											key={option.value}
											onPress={() => setAmountBowl(option.value)}
											style={[styles.bowlButton, isSelected && styles.bowlButtonSelected]}
										>
											<Text style={[styles.bowlText, isSelected && styles.bowlTextSelected]}>
												{option.label}
											</Text>
										</Pressable>
									);
								})}
							</View>
						</View>
					) : null}

					<View style={styles.section}>
						<View style={globalStyles.rowBetween}>
							<Text style={styles.sectionLabel}>Notes</Text>
							<Text style={styles.notesCount}>{notes.length}/{NOTES_LIMIT}</Text>
						</View>
						<TextInput
							maxLength={NOTES_LIMIT}
							multiline
							onChangeText={setNotes}
							placeholder="Optional notes..."
							placeholderTextColor={colors.light.textSecondary}
							style={styles.notesInput}
							textAlignVertical="top"
							value={notes}
						/>
					</View>
				</ScrollView>

				<View style={styles.footer}>
					{formError ? <Text style={styles.errorText}>{formError}</Text> : null}
					<Pressable
						accessibilityRole="button"
						disabled={isSaving}
						onPress={() => void saveMeal()}
						style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
					>
						<Text style={styles.saveButtonText}>
							{isSaving ? "Saving..." : mealToEdit ? "Update Meal" : "Save Meal"}
						</Text>
					</Pressable>
				</View>
				<ConfirmDeleteModal
					confirmLabel="Delete"
					message="Are you sure you want to delete this meal log permanently?"
					onCancel={() => setIsDeleteModalVisible(false)}
					onConfirm={() => void deleteMeal()}
					title="Delete meal entry?"
					visible={isDeleteModalVisible}
				/>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

function StepperButton({
	icon,
	onPress,
}: {
	icon: "add" | "remove";
	onPress: () => void;
}) {
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.stepperButton}>
			<Ionicons color={colors.light.primary} name={icon} size={22} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	bowlButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flex: 1,
		paddingVertical: 14,
	},
	bowlButtonSelected: {
		backgroundColor: routineConfig.quickActions.meal.backgroundColor,
		borderColor: routineConfig.quickActions.meal.accentColor,
	},
	bowlGrid: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	bowlText: {
		color: colors.light.textPrimary,
		fontSize: 14,
		fontWeight: "700",
	},
	bowlTextSelected: {
		color: routineConfig.quickActions.meal.accentColor,
	},
	cancelText: {
		color: colors.light.primary,
		fontSize: 15,
		fontWeight: "700",
	},
	content: {
		gap: spacing.lg,
		padding: spacing.md,
		paddingBottom: spacing.xl,
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
	deleteIcon: {
		color: colors.light.error,
		alignSelf: "flex-end",
	},
	headerSpacer: {
		width: 72,
	},
	headerTitle: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.sm,
	},
	keyboardView: {
		flex: 1,
	},
	notesCount: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "700",
	},
	notesInput: {
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		color: colors.light.textPrimary,
		fontSize: 15,
		minHeight: 96,
		padding: spacing.md,
	},
	dateTimeHint: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "600",
		marginTop: 2,
	},
	dateTimeField: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	dateTimeValue: {
		color: colors.light.textPrimary,
		fontSize: 16,
		fontWeight: "800",
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
	errorText: {
		color: colors.light.error,
		fontSize: 13,
		fontWeight: "700",
		marginBottom: spacing.sm,
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
		flexBasis: "48%",
		paddingHorizontal: spacing.sm,
		paddingVertical: 14,
	},
	segmentButtonSelected: {
		backgroundColor: routineConfig.quickActions.meal.backgroundColor,
		borderColor: routineConfig.quickActions.meal.accentColor,
	},
	segmentGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	segmentText: {
		color: colors.light.textPrimary,
		fontSize: 14,
		fontWeight: "700",
		textAlign: "center",
	},
	segmentTextSelected: {
		color: routineConfig.quickActions.meal.accentColor,
	},
	stepperButton: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		height: 48,
		justifyContent: "center",
		width: 56,
	},
	stepperRow: {
		alignItems: "center",
		backgroundColor: colors.light.surface,
		borderColor: colors.light.border,
		borderRadius: 16,
		borderWidth: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		padding: spacing.sm,
	},
	stepperValue: {
		color: colors.light.textPrimary,
		fontSize: 20,
		fontWeight: "800",
	},
});

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not save meal. Please try again.";
}
