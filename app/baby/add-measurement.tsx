import { useAppPreferences, useTimelineTimeZone , useAppTheme } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useGrowthData } from "@/context/GrowthDataContext";
import { spacing, type ThemeColors } from "@/styles/globalStyles";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";

const NOTES_LIMIT = 200;

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function AddMeasurementScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { growthId } = useLocalSearchParams<{ growthId?: string }>();
	const { selectedBaby } = useBabySelection();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const {
		createGrowthRecord,
		deleteGrowthRecord,
		getGrowthRecord,
		updateGrowthRecord,
	} = useGrowthData();
	const { preferredLengthUnit, preferredWeightUnit } = useAppPreferences();
	const existingRecord = useMemo(
		() => (growthId ? getGrowthRecord(growthId) : undefined),
		[getGrowthRecord, growthId],
	);
	const isEditMode = Boolean(growthId);
	const [measuredDate, setMeasuredDate] = useState(new Date());
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [heightText, setHeightText] = useState("");
	const [weightText, setWeightText] = useState("");
	const [headText, setHeadText] = useState("");
	const [notes, setNotes] = useState("");
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	useEffect(() => {
		if (!existingRecord) return;

		setMeasuredDate(parseDateKey(existingRecord.measuredDate));
		setHeightText(formatLengthForInput(existingRecord.heightMm, preferredLengthUnit));
		setWeightText(formatWeightForInput(existingRecord.weightGrams, preferredWeightUnit));
		setHeadText(formatLengthForInput(existingRecord.headCircumferenceMm, preferredLengthUnit));
		setNotes(existingRecord.notes ?? "");
	}, [existingRecord, preferredLengthUnit, preferredWeightUnit]);

	const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setIsPickerOpen(false);
		}

		if (event.type === "dismissed" || !selectedDate) {
			return;
		}

		setMeasuredDate(selectedDate);
	};

	const saveMeasurement = async () => {
		if (!selectedBaby) {
			setFormError("Select a baby before adding a measurement.");
			return;
		}

		const heightMm = parseLengthToMm(heightText, preferredLengthUnit);
		const headCircumferenceMm = parseLengthToMm(headText, preferredLengthUnit);
		const weightGrams = parseWeightToGrams(weightText, preferredWeightUnit);

		if (!heightMm && !headCircumferenceMm && !weightGrams) {
			setFormError("Enter at least one measurement.");
			return;
		}

		setIsSaving(true);
		setFormError(null);

		try {
			const input = {
				headCircumferenceMm: headCircumferenceMm ?? undefined,
				heightMm: heightMm ?? undefined,
				measuredDate: getDateKey(measuredDate),
				notes,
				weightGrams: weightGrams ?? undefined,
			};
			const didSave = growthId
				? await updateGrowthRecord(growthId, input)
				: await createGrowthRecord(input);

			if (!didSave) {
				setFormError("Could not save measurement. Please try again.");
				return;
			}

			router.back();
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	const removeMeasurement = async () => {
		if (!growthId) return;

		setIsSaving(true);
		setFormError(null);

		try {
			const didDelete = await deleteGrowthRecord(growthId);

			if (didDelete) {
				setIsDeleteModalVisible(false);
				router.back();
			} else {
				setFormError("Could not delete measurement. Please try again.");
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
					<Text style={globalStyles.sectionTitleText}>
						{isEditMode ? "Edit Measurement" : "Add Measurement"}
					</Text>
					{isEditMode? (
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
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Measurement date</Text>
						<Pressable
							accessibilityRole="button"
							onPress={() => setIsPickerOpen(true)}
							style={styles.dateField}
						>
							<Ionicons color={themeColors.textSecondary} name="calendar-outline" size={20} />
							<Text style={styles.dateText}>{formatDate(measuredDate, timelineTimeZone)}</Text>
						</Pressable>
						{isPickerOpen ? (
							<DateTimePicker
								display={Platform.OS === "ios" ? "spinner" : "default"}
								mode="date"
								onChange={handlePickerChange}
								value={measuredDate}
							/>
						) : null}
					</View>
					<MeasurementInput
						label="Height"
						onChangeText={setHeightText}
						suffix={preferredLengthUnit}
						value={heightText}
					/>
					<MeasurementInput
						label="Weight"
						onChangeText={setWeightText}
						suffix={preferredWeightUnit}
						value={weightText}
					/>
					<MeasurementInput
						label="Head size"
						onChangeText={setHeadText}
						suffix={preferredLengthUnit}
						value={headText}
					/>
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
							placeholderTextColor={themeColors.textSecondary}
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
						onPress={() => void saveMeasurement()}
						style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
					>
						<Text style={styles.saveButtonText}>
							{isSaving ? "Saving..." : "Save Measurement"}
						</Text>
					</Pressable>
				</View>
				<ConfirmDeleteModal
					confirmLabel="Delete"
					message="Are you sure you want to delete this measurement permanently?"
					onCancel={() => setIsDeleteModalVisible(false)}
					onConfirm={() => void removeMeasurement()}
					title="Delete measurement?"
					visible={isDeleteModalVisible}
				/>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

function MeasurementInput({
	label,
	onChangeText,
	placeholder,
	suffix,
	value,
}: {
	label: string;
	onChangeText: (value: string) => void;
	placeholder?: string;
	suffix: string;
	value: string;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabel}>{label}</Text>
			<View style={styles.measurementInputGroup}>
				<TextInput
					keyboardType="decimal-pad"
					onChangeText={(text) => onChangeText(sanitizeDecimalInput(text))}
					placeholder={placeholder}
					placeholderTextColor={themeColors.textSecondary}
					style={styles.measurementInput}
					value={value}
				/>
				<Text style={styles.measurementSuffix}>{suffix}</Text>
			</View>
		</View>
	);
}

function getDateKey(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatDate(value: Date, timeZone?: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(value);
}

function parseDateKey(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function formatLengthForInput(valueMm: number | null, unit: "cm" | "in") {
	if (typeof valueMm !== "number") return "";
	const value = unit === "cm" ? valueMm / 10 : valueMm / 25.4;
	return formatInputDecimal(value);
}

function formatWeightForInput(valueGrams: number | null, unit: "kg" | "lb") {
	if (typeof valueGrams !== "number") return "";
	const value = unit === "kg" ? valueGrams / 1000 : valueGrams / 453.59237;
	return formatInputDecimal(value);
}

function formatInputDecimal(value: number) {
	return value.toFixed(2).replace(/\.?0+$/, "");
}

function parsePositiveDecimal(value: string) {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLengthToMm(value: string, unit: "cm" | "in") {
	const parsed = parsePositiveDecimal(value);
	if (!parsed) return null;
	return Math.round(unit === "cm" ? parsed * 10 : parsed * 25.4);
}

function parseWeightToGrams(value: string, unit: "kg" | "lb") {
	const parsed = parsePositiveDecimal(value);
	if (!parsed) return null;
	return Math.round(unit === "kg" ? parsed * 1000 : parsed * 453.59237);
}

function sanitizeDecimalInput(value: string) {
	const normalized = value.replace(/,/g, ".");
	const [whole = "", ...rest] = normalized.split(".");
	const wholeDigits = whole.replace(/\D/g, "");
	const decimalDigits = rest.join("").replace(/\D/g, "").slice(0, 2);

	if (normalized.includes(".")) {
		return `${wholeDigits}.${decimalDigits}`;
	}

	return wholeDigits;
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not save measurement. Please try again.";
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
	cancelText: {
		color: themeColors.primary,
		fontSize: 15,
		fontWeight: "700",
	},
	content: {
		gap: spacing.lg,
		padding: spacing.md,
	},
	dateField: {
		alignItems: "center",
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	dateText: {
		color: themeColors.textPrimary,
		fontSize: 16,
		fontWeight: "800",
	},
	deleteIcon: {
		color: themeColors.error,
		alignSelf: "flex-end",
	},
	errorText: {
		color: themeColors.error,
		fontSize: 13,
		fontWeight: "700",
		marginBottom: spacing.sm,
	},
	footer: {
		backgroundColor: themeColors.background,
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
	headerSpacer: {
		width: 72,
	},
	keyboardView: {
		flex: 1,
	},
	measurementInput: {
		color: themeColors.textPrimary,
		flex: 1,
		fontSize: 18,
		fontWeight: "800",
		padding: 0,
	},
	measurementInputGroup: {
		alignItems: "center",
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		flexDirection: "row",
		gap: spacing.sm,
		padding: spacing.md,
	},
	measurementSuffix: {
		color: themeColors.textPrimary,
		fontSize: 16,
		fontWeight: "800",
	},
	notesCount: {
		color: themeColors.textSecondary,
		fontSize: 12,
		fontWeight: "700",
	},
	notesInput: {
		backgroundColor: themeColors.surface,
		borderColor: themeColors.border,
		borderRadius: 14,
		borderWidth: 1,
		color: themeColors.textPrimary,
		fontSize: 15,
		minHeight: 96,
		padding: spacing.md,
	},
	saveButton: {
		alignItems: "center",
		backgroundColor: themeColors.primary,
		borderRadius: 16,
		paddingVertical: 16,
	},
	saveButtonDisabled: {
		opacity: 0.5,
	},
	saveButtonText: {
		color: themeColors.surface,
		fontSize: 16,
		fontWeight: "800",
	},
	section: {
		gap: spacing.sm,
	},
	sectionLabel: {
		color: themeColors.textPrimary,
		fontSize: 15,
		fontWeight: "800",
	},
});
}
