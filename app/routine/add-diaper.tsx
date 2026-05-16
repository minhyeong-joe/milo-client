import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useTimelineTimeZone } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { RoutineIcon } from "@/components/routine/RoutineIcon";
import { useRoutineData } from "@/context/RoutineDataContext";
import type { DiaperColor, DiaperEvent, DiaperType } from "@/data/homeData";
import { routineConfig } from "@/data/homeData";
import { colors, globalStyles, spacing } from "@/styles/globalStyles";
import { formatClockTime } from "@/utils/routineDisplay";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
	DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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

const NOTES_LIMIT = 100;

const diaperTypes: DiaperType[] = ["wet", "dirty", "both", "dry"];
const diaperColors: DiaperColor[] = ["green", "brown", "yellow", "black"];

function formatDate(value: Date, timeZone?: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(value);
}

function needsColor(type: DiaperType) {
	return type === "dirty" || type === "both";
}

export default function AddDiaperScreen() {
	const router = useRouter();
	const { diaperId } = useLocalSearchParams<{ diaperId?: string }>();
	const { selectedBaby } = useBabySelection();
	const { addDiaper, dailyLogs, getLatestDiaper, removeDiaper, updateDiaper } = useRoutineData();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const diaperToEdit = dailyLogs
		.flatMap((day) => day.timeline)
		.find(
			(event): event is DiaperEvent =>
				event.kind === "diaper" && event.id === diaperId,
		);
	const latestDiaper = getLatestDiaper();
	const initialType = diaperToEdit?.type ?? latestDiaper?.type ?? "wet";
	const initialColor = needsColor(initialType) ? diaperToEdit?.color : undefined;
	const [diaperTime, setDiaperTime] = useState(
		() => new Date(diaperToEdit?.time ?? Date.now()),
	);
	const [activePicker, setActivePicker] = useState<"date" | "time" | null>(
		null,
	);
	const [diaperType, setDiaperType] = useState<DiaperType>(initialType);
	const [diaperColor, setDiaperColor] = useState<DiaperColor | undefined>(
		initialColor,
	);
	const [notes, setNotes] = useState(diaperToEdit?.notes ?? "");
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const handlePickerChange = (
		event: DateTimePickerEvent,
		selectedDate?: Date,
	) => {
		if (Platform.OS === "android") {
			setActivePicker(null);
		}

		if (event.type === "dismissed" || !selectedDate) {
			return;
		}

		setDiaperTime(selectedDate);
	};

	const handleTypeChange = (type: DiaperType) => {
		setDiaperType(type);

		if (!needsColor(type)) {
			setDiaperColor(undefined);
		}
	};

	const saveDiaper = async () => {
		setIsSaving(true);
		setFormError(null);
		const input = {
			color: needsColor(diaperType) ? diaperColor : undefined,
			notes,
			time: diaperTime.toISOString(),
			type: diaperType,
		};

		try {
			const didSave = diaperToEdit
				? await updateDiaper({ ...input, id: diaperToEdit.id })
				: await addDiaper(input);

			if (didSave) {
				router.back();
			} else {
				setFormError("Select a baby before saving this diaper.");
			}
		} catch (error) {
			setFormError(getErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	};

	const deleteDiaper = async () => {
		if (!diaperToEdit) return;

		setIsSaving(true);
		setFormError(null);

		try {
			const didDelete = await removeDiaper(diaperToEdit.id);

			if (didDelete) {
				setIsDeleteModalVisible(false);
				router.back();
			} else {
				setFormError("Select a baby before deleting this diaper.");
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
					<Pressable
						accessibilityRole="button"
						onPress={() => router.back()}
						style={styles.headerButton}
					>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
					<View style={styles.headerTitle}>
						<RoutineIcon kind="diaper" size={30} />
						<Text style={globalStyles.sectionTitleText}>Diaper</Text>
					</View>
					{diaperToEdit ? (
						<Pressable
							accessibilityRole="button"
							disabled={isSaving}
							onPress={() => setIsDeleteModalVisible(true)}
							style={styles.headerButton}
						>
							<Ionicons name="trash-outline" size={24} style={styles.deleteIcon} />
						</Pressable>
					) : (
						<View style={styles.headerSpacer} />
					)}
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
							<Ionicons
								color={colors.light.textSecondary}
								name="calendar-outline"
								size={20}
							/>
							<View>
							<Text style={styles.dateTimeValue}>{formatDate(diaperTime, timelineTimeZone)}</Text>
								<Text style={styles.dateTimeHint}>Date</Text>
							</View>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => setActivePicker("time")}
							style={styles.dateTimeField}
						>
							<Ionicons
								color={colors.light.textSecondary}
								name="time-outline"
								size={20}
							/>
							<View>
								<Text style={styles.dateTimeValue}>
									{formatClockTime(diaperTime.toISOString(), timelineTimeZone)}
								</Text>
								<Text style={styles.dateTimeHint}>Time</Text>
							</View>
						</Pressable>
						{activePicker ? (
							<DateTimePicker
								display={Platform.OS === "ios" ? "spinner" : "default"}
								mode={activePicker}
								onChange={handlePickerChange}
								value={diaperTime}
							/>
						) : null}
					</View>

					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Type</Text>
						<View style={styles.segmentGrid}>
							{diaperTypes.map((type) => {
								const isSelected = diaperType === type;

								return (
									<Pressable
										accessibilityRole="button"
										key={type}
										onPress={() => handleTypeChange(type)}
										style={[
											styles.segmentButton,
											isSelected && styles.segmentButtonSelected,
										]}
									>
										<Text
											style={[
												styles.segmentText,
												isSelected && styles.segmentTextSelected,
											]}
										>
											{routineConfig.diaperTypes[type]}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</View>

					{needsColor(diaperType) ? (
						<View style={styles.section}>
							<Text style={styles.sectionLabel}>Color</Text>
							<View style={styles.colorGrid}>
								{diaperColors.map((color) => {
									const option = routineConfig.diaperColors[color];
									const isSelected = diaperColor === color;

									return (
										<Pressable
											accessibilityRole="button"
											key={color}
											onPress={() => setDiaperColor(color)}
											style={[
												styles.colorButton,
												isSelected && styles.colorButtonSelected,
											]}
										>
											<View
												style={[
													styles.colorSwatch,
													{ backgroundColor: option.swatch },
												]}
											/>
											<Text
												style={[
													styles.colorText,
													isSelected && styles.colorTextSelected,
												]}
											>
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
							<Text style={styles.notesCount}>
								{notes.length}/{NOTES_LIMIT}
							</Text>
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
						onPress={() => void saveDiaper()}
						style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
					>
						<Text style={styles.saveButtonText}>
							{isSaving ? "Saving..." : diaperToEdit ? "Update Diaper" : "Save Diaper"}
						</Text>
					</Pressable>
				</View>
				<ConfirmDeleteModal
					confirmLabel="Delete"
					message="Are you sure you want to delete this diaper log permanently?"
					onCancel={() => setIsDeleteModalVisible(false)}
					onConfirm={() => void deleteDiaper()}
					title="Delete diaper entry?"
					visible={isDeleteModalVisible}
				/>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	cancelText: {
		color: colors.light.primary,
		fontSize: 15,
		fontWeight: "700",
	},
	colorButton: {
		alignItems: "center",
		borderColor: colors.light.border,
		borderRadius: 14,
		borderWidth: 1,
		flexBasis: "48%",
		flexDirection: "row",
		gap: spacing.sm,
		paddingHorizontal: spacing.sm,
		paddingVertical: 14,
	},
	colorButtonSelected: {
		backgroundColor: routineConfig.quickActions.diaper.backgroundColor,
		borderColor: routineConfig.quickActions.diaper.accentColor,
	},
	colorGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	colorSwatch: {
		borderRadius: 8,
		height: 16,
		width: 16,
	},
	colorText: {
		color: colors.light.textPrimary,
		fontSize: 14,
		fontWeight: "700",
	},
	colorTextSelected: {
		color: routineConfig.quickActions.diaper.accentColor,
	},
	content: {
		gap: spacing.lg,
		padding: spacing.md,
		paddingBottom: spacing.xl,
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
	dateTimeHint: {
		color: colors.light.textSecondary,
		fontSize: 12,
		fontWeight: "600",
		marginTop: 2,
	},
	dateTimeValue: {
		color: colors.light.textPrimary,
		fontSize: 16,
		fontWeight: "800",
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
		alignSelf: "flex-end",
		color: colors.light.error,
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
	saveButton: {
		alignItems: "center",
		backgroundColor: routineConfig.quickActions.diaper.accentColor,
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
		backgroundColor: routineConfig.quickActions.diaper.backgroundColor,
		borderColor: routineConfig.quickActions.diaper.accentColor,
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
		color: routineConfig.quickActions.diaper.accentColor,
	},
});

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Could not save diaper. Please try again.";
}
