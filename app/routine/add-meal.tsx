import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import type { MealEvent, MealType } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { useRoutineData } from "@/context/RoutineDataContext";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { formatClockTime, formatOzInput, mlToOz, ozToMl } from "@/utils/routineDisplay";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
const BOTTLE_STEP_OZ = 0.5;
const SOLID_GRAMS_STEP = 5;
const DURATION_STEP_MINUTES = 5;
const NOTES_LIMIT = 100;
const DEFAULT_BOTTLE_ML = 60;
const DEFAULT_SOLID_GRAMS = 30;

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
	const {
		preferredSolidFoodUnit,
		preferredVolumeUnit,
		setPreferredSolidFoodUnit,
	} = useAppPreferences();
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
	const initialBottleAmountMlRef = useRef(
		mealToEdit?.amountMl ?? latestMeal?.amountMl ?? DEFAULT_BOTTLE_ML,
	);
	const previousVolumeUnitRef = useRef(preferredVolumeUnit);
	const [bottleAmountText, setBottleAmountText] = useState(() =>
		formatBottleAmountInput(initialBottleAmountMlRef.current, preferredVolumeUnit),
	);
	const [breastSide, setBreastSide] = useState<"left" | "right" | undefined>(mealToEdit?.breastSide ?? (mealType === "breastfeed" ? (latestMeal?.breastSide === "left"? "right" : "left") : undefined));
	const [durationMinutesText, setDurationMinutesText] = useState(() =>
		String(mealToEdit?.durationMinutes ?? latestMeal?.durationMinutes ?? 15),
	);
	const [amountBowl, setAmountBowl] = useState(mealToEdit?.amountBowl ?? latestMeal?.amountBowl ?? 0.5);
	const [solidInputMode, setSolidInputMode] = useState<"bowl" | "grams">(() =>
		mealToEdit?.amountGrams ? "grams" : mealToEdit?.amountBowl ? "bowl" : preferredSolidFoodUnit,
	);
	const [amountGramsText, setAmountGramsText] = useState(() =>
		String(mealToEdit?.amountGrams ?? latestMeal?.amountGrams ?? DEFAULT_SOLID_GRAMS),
	);
	const [notes, setNotes] = useState(mealToEdit?.notes ?? "");
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	useEffect(() => {
		const previousUnit = previousVolumeUnitRef.current;

		if (previousUnit === preferredVolumeUnit) {
			return;
		}

		setBottleAmountText((value) => {
			const amountMl = normalizeBottleAmountToMl(value, previousUnit);
			return formatBottleAmountInput(amountMl, preferredVolumeUnit);
		});
		previousVolumeUnitRef.current = preferredVolumeUnit;
	}, [preferredVolumeUnit]);

	const decrementBottle = () =>
		setBottleAmountText((value) =>
			preferredVolumeUnit === "oz"
				? formatOzInput(Math.max(BOTTLE_STEP_OZ, normalizeOzInput(value, BOTTLE_STEP_OZ) - BOTTLE_STEP_OZ))
				: String(Math.max(BOTTLE_STEP_ML, normalizePositiveInteger(value, BOTTLE_STEP_ML) - BOTTLE_STEP_ML)),
		);
	const incrementBottle = () =>
		setBottleAmountText((value) =>
			preferredVolumeUnit === "oz"
				? formatOzInput(normalizeOzInput(value, BOTTLE_STEP_OZ) + BOTTLE_STEP_OZ)
				: String(normalizePositiveInteger(value, BOTTLE_STEP_ML) + BOTTLE_STEP_ML),
		);
	const decrementDuration = () =>
		setDurationMinutesText((value) =>
			String(Math.max(
				DURATION_STEP_MINUTES,
				normalizePositiveInteger(value, DURATION_STEP_MINUTES) - DURATION_STEP_MINUTES,
			)),
		);
	const incrementDuration = () =>
		setDurationMinutesText((value) =>
			String(normalizePositiveInteger(value, DURATION_STEP_MINUTES) + DURATION_STEP_MINUTES),
		);
	const decrementSolidGrams = () =>
		setAmountGramsText((value) =>
			String(Math.max(SOLID_GRAMS_STEP, normalizePositiveInteger(value, SOLID_GRAMS_STEP) - SOLID_GRAMS_STEP)),
		);
	const incrementSolidGrams = () =>
		setAmountGramsText((value) =>
			String(normalizePositiveInteger(value, SOLID_GRAMS_STEP) + SOLID_GRAMS_STEP),
		);

	const selectSolidInputMode = (mode: "bowl" | "grams") => {
		setSolidInputMode(mode);
		void setPreferredSolidFoodUnit(mode);
	};

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
		const amountMl = normalizeBottleAmountToMl(
			bottleAmountText,
			preferredVolumeUnit,
		);
		const durationMinutes = normalizePositiveInteger(
			durationMinutesText,
			DURATION_STEP_MINUTES,
		);
		const input = {
			amountBowl: mealType === "solid" && solidInputMode === "bowl" ? amountBowl : undefined,
			amountGrams: mealType === "solid" && solidInputMode === "grams"
				? normalizePositiveInteger(amountGramsText, SOLID_GRAMS_STEP)
				: undefined,
			amountMl: isBottleMeal(mealType) ? amountMl : undefined,
			durationMinutes: mealType === "breastfeed" ? durationMinutes : undefined,
			breastSide: mealType === "breastfeed" ? breastSide : undefined,
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
							<View style={styles.segmentGrid}>
								{(["left", "right"] as const).map((side) => {
									const isSelected = breastSide === side;

									return (
										<Pressable
											accessibilityRole="button"
											key={side}
											onPress={() => setBreastSide(side)}
											style={[styles.segmentButton, isSelected && styles.segmentButtonSelected]}
										>
											<Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
												{side.charAt(0).toUpperCase() + side.slice(1)}
											</Text>
										</Pressable>
									);
								})}
							</View>
							<Text style={styles.sectionLabel}>Duration</Text>
							<View style={styles.stepperRow}>
								<StepperButton icon="remove" onPress={decrementDuration} />
								<StepperNumberInput
									onBlur={() =>
										setDurationMinutesText((value) =>
											String(normalizePositiveInteger(value, DURATION_STEP_MINUTES)),
										)
									}
									keyboardType="number-pad"
									onChangeText={setDurationMinutesText}
									suffix="min"
									value={durationMinutesText}
								/>
								<StepperButton icon="add" onPress={incrementDuration} />
							</View>
						</View>
					) : null}

					{isBottleMeal(mealType) ? (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>Amount</Text>
							<View style={styles.stepperRow}>
								<StepperButton icon="remove" onPress={decrementBottle} />
								<StepperNumberInput
									onBlur={() =>
										setBottleAmountText((value) =>
											formatBottleAmountInput(
												normalizeBottleAmountToMl(value, preferredVolumeUnit),
												preferredVolumeUnit,
											),
										)
									}
									keyboardType={preferredVolumeUnit === "oz" ? "decimal-pad" : "number-pad"}
									onChangeText={setBottleAmountText}
									suffix={preferredVolumeUnit === "oz" ? "oz" : "mL"}
									value={bottleAmountText}
								/>
								<StepperButton icon="add" onPress={incrementBottle} />
							</View>
						</View>
					) : null}

					{mealType === "solid" ? (
						<View style={styles.section}>
							<View style={styles.amountHeaderRow}>
								<Text style={styles.sectionLabel}>
									{solidInputMode === "grams" ? "Grams" : "Bowl"}
								</Text>
								<View style={styles.solidModeControl}>
									<SolidModeButton
										isSelected={solidInputMode === "bowl"}
										label="Bowl"
										onPress={() => selectSolidInputMode("bowl")}
									/>
									<SolidModeButton
										isSelected={solidInputMode === "grams"}
										label="Grams"
										onPress={() => selectSolidInputMode("grams")}
									/>
								</View>
							</View>
							{solidInputMode === "bowl" ? (
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
							) : (
								<View style={styles.stepperRow}>
									<StepperButton icon="remove" onPress={decrementSolidGrams} />
									<StepperNumberInput
										onBlur={() =>
											setAmountGramsText((value) =>
												String(normalizePositiveInteger(value, SOLID_GRAMS_STEP)),
											)
										}
										keyboardType="number-pad"
										onChangeText={setAmountGramsText}
										suffix="g"
										value={amountGramsText}
									/>
									<StepperButton icon="add" onPress={incrementSolidGrams} />
								</View>
							)}
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

function SolidModeButton({
	isSelected,
	label,
	onPress,
}: {
	isSelected: boolean;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: isSelected }}
			onPress={onPress}
			style={[styles.solidModeButton, isSelected && styles.solidModeButtonSelected]}
		>
			<Text style={[styles.solidModeText, isSelected && styles.solidModeTextSelected]}>
				{label}
			</Text>
		</Pressable>
	);
}

function StepperNumberInput({
	keyboardType,
	onBlur,
	onChangeText,
	suffix,
	value,
}: {
	keyboardType: "decimal-pad" | "number-pad";
	onBlur: () => void;
	onChangeText: (value: string) => void;
	suffix: string;
	value: string;
}) {
	return (
		<View style={styles.stepperInputGroup}>
			<TextInput
				keyboardType={keyboardType}
				onBlur={onBlur}
				onChangeText={(text) =>
					onChangeText(
						keyboardType === "decimal-pad"
							? sanitizeDecimalInput(text)
							: text.replace(/\D/g, ""),
					)
				}
				placeholder="0"
				placeholderTextColor={colors.light.textSecondary}
				selectTextOnFocus
				style={styles.stepperInput}
				value={value}
			/>
			<Text style={styles.stepperSuffix}>{suffix}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	amountHeaderRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.md,
		justifyContent: "space-between",
	},
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
	solidModeButton: {
		alignItems: "center",
		borderRadius: 9,
		flex: 1,
		paddingHorizontal: spacing.sm,
		paddingVertical: 7,
	},
	solidModeButtonSelected: {
		backgroundColor: routineConfig.quickActions.meal.accentColor,
	},
	solidModeControl: {
		backgroundColor: colors.light.background,
		borderColor: colors.light.border,
		borderRadius: 12,
		borderWidth: 1,
		flexDirection: "row",
		minWidth: 144,
		padding: 3,
	},
	solidModeText: {
		color: colors.light.textSecondary,
		fontSize: 13,
		fontWeight: "800",
	},
	solidModeTextSelected: {
		color: colors.light.surface,
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
	stepperInputGroup: {
		alignItems: "baseline",
		flexDirection: "row",
		gap: spacing.xs,
		justifyContent: "center",
		minWidth: 112,
	},
	stepperInput: {
		color: colors.light.textPrimary,
		fontSize: 20,
		fontWeight: "800",
		minWidth: 48,
		padding: 0,
		textAlign: "center",
	},
	stepperSuffix: {
		color: colors.light.textPrimary,
		fontSize: 20,
		fontWeight: "800",
	},
});

function normalizePositiveInteger(value: string, fallback: number) {
	const parsed = Number.parseInt(value, 10);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

function normalizeBottleAmountToMl(
	value: string,
	unit: "ml" | "oz",
) {
	if (unit === "oz") {
		return ozToMl(normalizeOzInput(value, BOTTLE_STEP_OZ));
	}

	return normalizePositiveInteger(value, BOTTLE_STEP_ML);
}

function formatBottleAmountInput(amountMl: number, unit: "ml" | "oz") {
	if (unit === "oz") {
		return formatOzInput(mlToOz(amountMl));
	}

	return String(Math.round(amountMl));
}

function normalizeOzInput(value: string, fallback: number) {
	const parsed = Number.parseFloat(value);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return Math.round(parsed * 10) / 10;
}

function sanitizeDecimalInput(value: string) {
	const normalized = value.replace(/,/g, ".");
	const [whole = "", ...rest] = normalized.split(".");
	const wholeDigits = whole.replace(/\D/g, "");
	const decimalDigits = rest.join("").replace(/\D/g, "").slice(0, 1);

	if (normalized.includes(".")) {
		return `${wholeDigits}.${decimalDigits}`;
	}

	return wholeDigits;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not save meal. Please try again.";
}
