import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useAppPreferences, useAppTheme, useTimelineTimeZone } from "@/context/AppPreferencesContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import { useImmunizationData } from "@/context/ImmunizationDataContext";
import type {
	ImmunizationRecordInput,
	ImmunizationScheduleItem,
	ImmunizationScheduleProfile,
} from "@/services/api/immunizations";
import type { LocalImmunizationRecord } from "@/services/immunizations/immunizationOfflineStore";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import {
	deriveImmunizationScheduleSections,
	getAgeMonths,
	type ImmunizationStatus,
	type ScheduleListItem,
} from "@/utils/immunizationStatus";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type EditorState =
	| { mode: "schedule"; record?: LocalImmunizationRecord; scheduleItem: ImmunizationScheduleItem }
	| { mode: "custom"; record?: LocalImmunizationRecord };

const NOTES_LIMIT = 500;
const SHORT_FIELD_LIMIT = 120;
const LOT_LIMIT = 80;
const DOSE_LIMIT = 80;
const PROFILE_OPTIONS: ImmunizationScheduleProfile[] = [
	"US_CDC",
	"CUSTOM",
	"KR_KDCA",
	"WHO_GENERAL",
];
const PROFILE_DETAILS: Record<ImmunizationScheduleProfile, {
	asOfText: string;
	helperTone: "info" | "warning";
	label: string;
	subtitle: string;
}> = {
	CUSTOM: {
		asOfText: "No external guideline data",
		helperTone: "info",
		label: "Custom",
		subtitle: "Manual records only",
	},
	KR_KDCA: {
		asOfText: "Official 2025 standard schedule",
		helperTone: "warning",
		label: "KR KDCA",
		subtitle: "Korea routine childhood checklist",
	},
	US_CDC: {
		asOfText: "Official as of Jul 2, 2025",
		helperTone: "warning",
		label: "US CDC",
		subtitle: "US routine childhood checklist",
	},
	WHO_GENERAL: {
		asOfText: "Official as of Dec 1, 2025",
		helperTone: "warning",
		label: "WHO General",
		subtitle: "Global routine planning guidance",
	},
};

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function ImmunizationScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { selectedBaby } = useBabySelection();
	const {
		createImmunizationRecord,
		deleteImmunizationRecord,
		isLoading,
		loadImmunizations,
		records,
		scheduleItems,
		scheduleProfile,
		syncError,
		updateImmunizationProfile,
		updateImmunizationRecord,
	} = useImmunizationData();
	const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
	const [editorState, setEditorState] = useState<EditorState | null>(null);
	const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

	useEffect(() => {
		void loadImmunizations({ sync: true }).catch((error) => console.warn(error));
	}, [loadImmunizations]);

	const derived = useMemo(
		() => deriveImmunizationScheduleSections(scheduleItems, records, selectedBaby?.birthdate),
		[records, scheduleItems, selectedBaby?.birthdate],
	);
	const customRecords = useMemo(
		() => records
			.filter((record) => scheduleProfile === "CUSTOM" || record.isCustom || !record.scheduleItemId)
			.sort((left, right) => right.givenDate.localeCompare(left.givenDate)),
		[records, scheduleProfile],
	);
	const ageLabel = selectedBaby ? formatBabyAge(selectedBaby.birthdate) : "No baby selected";

	const toggleSection = (sectionId: string) => {
		setCollapsedSections((current) => ({
			...current,
			[sectionId]: !current[sectionId],
		}));
	};

	const handleProfileSelect = async (profile: ImmunizationScheduleProfile) => {
		const didSave = await updateImmunizationProfile(profile);
		if (didSave) {
			setIsProfileModalVisible(false);
		}
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<View style={styles.header}>
				<Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
					<Ionicons color={themeColors.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Text style={globalStyles.sectionTitleText}>Immunizations</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Immunization schedule settings"
					onPress={() => setIsProfileModalVisible(true)}
					style={styles.headerButton}
				>
					<Ionicons color={themeColors.textPrimary} name="settings-outline" size={22} />
				</Pressable>
			</View>

			<ScrollView
				contentContainerStyle={styles.content}
				refreshControl={
					<RefreshControl
						refreshing={isLoading}
						tintColor={themeColors.primary}
						onRefresh={() => void loadImmunizations({ sync: true })}
					/>
				}
			>
				<View style={globalStyles.card}>
					<View style={styles.summaryText}>
						<Text style={styles.summaryTitle}>{selectedBaby?.name ?? "Baby"}</Text>
						<Text style={globalStyles.bodyText}>Age: {ageLabel}</Text>
						<Text style={styles.profileText}>{PROFILE_DETAILS[scheduleProfile].label} schedule</Text>
					</View>
					<View style={styles.countGrid}>
						<CountPill label="Due" tone="due" value={derived.dueNow.length} />
						<CountPill label="Past due" tone="pastDue" value={derived.pastDue.length} />
						<CountPill label="Done" tone="done" value={derived.done.length} />
					</View>
				</View>

				<View style={[globalStyles.card, styles.disclaimerCard]}>
					<Ionicons color={themeColors.primary} name="information-circle-outline" size={20} />
					<Text style={styles.disclaimerText}>
						This tracker is for record keeping only and is not medical advice. Do not follow any schedule blindly;
						confirm vaccine timing and eligibility with a licensed healthcare professional.
					</Text>
				</View>

				{syncError ? (
					<View style={[globalStyles.card, styles.syncCard]}>
						<Text style={styles.syncText}>{syncError}</Text>
					</View>
				) : null}

				{!selectedBaby ? (
					<View style={globalStyles.card}>
						<Text style={globalStyles.bodyText}>Select a baby to view immunization records.</Text>
					</View>
				) : null}

				{selectedBaby && scheduleProfile === "CUSTOM" && customRecords.length === 0 ? (
					<View style={globalStyles.card}>
						<Text style={styles.emptyTitle}>Custom tracking</Text>
						<Text style={globalStyles.bodyText}>Add immunizations manually to keep a private record.</Text>
					</View>
				) : null}

				<ScheduleSection
					collapsed={collapsedSections.pastDue}
					emptyText="No past due routine items."
					items={derived.pastDue}
					onPressItem={(item) => setEditorState({
						mode: "schedule",
						record: item.record,
						scheduleItem: item.scheduleItem,
					})}
					onToggle={() => toggleSection("pastDue")}
					status="pastDue"
					title="Past due"
				/>
				<ScheduleSection
					collapsed={collapsedSections.dueNow}
					emptyText="No routine items due right now."
					items={derived.dueNow}
					onPressItem={(item) => setEditorState({
						mode: "schedule",
						record: item.record,
						scheduleItem: item.scheduleItem,
					})}
					onToggle={() => toggleSection("dueNow")}
					status="dueNow"
					title="Due now"
				/>
				<ScheduleSection
					collapsed={collapsedSections.done}
					emptyText="Completed routine items will appear here."
					items={derived.done}
					onPressItem={(item) => setEditorState({
						mode: "schedule",
						record: item.record,
						scheduleItem: item.scheduleItem,
					})}
					onToggle={() => toggleSection("done")}
					status="done"
					title="Completed"
				/>
				<UpcomingSection
					collapsed={collapsedSections.upcoming}
					groups={derived.upcomingGroups}
					onPressItem={(item) => setEditorState({
						mode: "schedule",
						record: item.record,
						scheduleItem: item.scheduleItem,
					})}
					onToggle={() => toggleSection("upcoming")}
				/>

				<CustomRecordsSection
					collapsed={collapsedSections.custom}
					records={customRecords}
					onAdd={() => setEditorState({ mode: "custom" })}
					onPressRecord={(record) => setEditorState({ mode: "custom", record })}
					onToggle={() => toggleSection("custom")}
				/>
			</ScrollView>

			<ImmunizationEditorModal
				editorState={editorState}
				onClose={() => setEditorState(null)}
				onCreate={createImmunizationRecord}
				onDelete={deleteImmunizationRecord}
				onUpdate={updateImmunizationRecord}
				visible={Boolean(editorState)}
			/>
			<ProfileModal
				currentProfile={scheduleProfile}
				onClose={() => setIsProfileModalVisible(false)}
				onSelect={(profile) => void handleProfileSelect(profile)}
				visible={isProfileModalVisible}
			/>
		</SafeAreaView>
	);
}

function CountPill({
	label,
	tone,
	value,
}: {
	label: string;
	tone: "done" | "due" | "pastDue";
	value: number;
}) {
	const { styles } = useThemeStyles();
	return (
		<View style={[styles.countPill, styles[`${tone}Pill`]]}>
			<Text style={styles.countValue}>{value}</Text>
			<Text style={styles.countLabel}>{label}</Text>
		</View>
	);
}

function ScheduleSection({
	collapsed,
	emptyText,
	items,
	onPressItem,
	onToggle,
	status,
	title,
}: {
	collapsed?: boolean;
	emptyText: string;
	items: ScheduleListItem[];
	onPressItem: (item: ScheduleListItem) => void;
	onToggle: () => void;
	status: ImmunizationStatus;
	title: string;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();

	return (
		<View style={globalStyles.card}>
			<Pressable accessibilityRole="button" onPress={onToggle} style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>{title}</Text>
				<View style={styles.sectionHeaderRight}>
					<Text style={styles.sectionCount}>{items.length}</Text>
					<Ionicons
						color={themeColors.textSecondary}
						name={collapsed ? "chevron-down" : "chevron-up"}
						size={18}
					/>
				</View>
			</Pressable>
			{!collapsed ? (
				<View style={styles.listWrap}>
					{items.length === 0 ? <Text style={globalStyles.bodyText}>{emptyText}</Text> : null}
					{items.map((item) => (
						<ScheduleRow
							item={item}
							key={item.scheduleItem.id}
							onPress={() => onPressItem(item)}
							status={status}
						/>
					))}
				</View>
			) : null}
		</View>
	);
}

function UpcomingSection({
	collapsed,
	groups,
	onPressItem,
	onToggle,
}: {
	collapsed?: boolean;
	groups: { displayAge: string; items: ScheduleListItem[] }[];
	onPressItem: (item: ScheduleListItem) => void;
	onToggle: () => void;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const total = groups.reduce((count, group) => count + group.items.length, 0);

	return (
		<View style={globalStyles.card}>
			<Pressable accessibilityRole="button" onPress={onToggle} style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Upcoming</Text>
				<View style={styles.sectionHeaderRight}>
					<Text style={styles.sectionCount}>{total}</Text>
					<Ionicons
						color={themeColors.textSecondary}
						name={collapsed ? "chevron-down" : "chevron-up"}
						size={18}
					/>
				</View>
			</Pressable>
			{!collapsed ? (
				<View style={styles.listWrap}>
					{groups.length === 0 ? <Text style={globalStyles.bodyText}>No upcoming routine items.</Text> : null}
					{groups.map((group) => (
						<View key={group.displayAge} style={styles.upcomingGroup}>
							<Text style={styles.upcomingGroupTitle}>{group.displayAge}</Text>
							{group.items.map((item) => (
								<ScheduleRow
									item={item}
									key={item.scheduleItem.id}
									onPress={() => onPressItem(item)}
									status="upcoming"
								/>
							))}
						</View>
					))}
				</View>
			) : null}
		</View>
	);
}

function CustomRecordsSection({
	collapsed,
	records,
	onAdd,
	onPressRecord,
	onToggle,
}: {
	collapsed?: boolean;
	records: LocalImmunizationRecord[];
	onAdd: () => void;
	onPressRecord: (record: LocalImmunizationRecord) => void;
	onToggle: () => void;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();

	return (
		<View style={globalStyles.card}>
			<Pressable accessibilityRole="button" onPress={onToggle} style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Custom records</Text>
				<View style={styles.sectionHeaderRight}>
					<Text style={styles.sectionCount}>{records.length}</Text>
					<Ionicons
						color={themeColors.textSecondary}
						name={collapsed ? "chevron-down" : "chevron-up"}
						size={18}
					/>
				</View>
			</Pressable>
			{!collapsed ? (
				<View style={styles.listWrap}>
					<Pressable accessibilityRole="button" onPress={onAdd} style={styles.addCustomButton}>
						<Ionicons color={themeColors.primary} name="add-circle-outline" size={20} />
						<Text style={styles.addCustomText}>Add custom immunization</Text>
					</Pressable>
					{records.map((record) => (
						<RecordRow key={record.id} onPress={() => onPressRecord(record)} record={record} />
					))}
				</View>
			) : null}
		</View>
	);
}

function ScheduleRow({
	item,
	onPress,
	status,
}: {
	item: ScheduleListItem;
	onPress: () => void;
	status: ImmunizationStatus;
}) {
	const { themeColors, styles } = useThemeStyles();
	const isDone = status === "done";

	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.scheduleRow}>
			<View style={[styles.checkCircle, isDone && styles.checkCircleDone]}>
				{isDone ? <Ionicons color={themeColors.surface} name="checkmark" size={16} /> : null}
			</View>
			<View style={styles.rowTextWrap}>
				<Text style={styles.rowTitle}>
					{item.scheduleItem.vaccineName} {item.scheduleItem.doseLabel}
				</Text>
				<Text style={styles.rowSubtitle}>
					Recommended: {item.scheduleItem.displayAge}
					{item.record ? ` - Given ${formatDateKey(item.record.givenDate)}` : ""}
				</Text>
				{item.scheduleItem.notes ? <Text style={styles.rowNote}>{item.scheduleItem.notes}</Text> : null}
				{item.record?.syncStatus === "pending" || item.record?.syncStatus === "failed" ? (
					<Text style={[
						styles.syncBadge,
						item.record.syncStatus === "failed" && styles.syncBadgeFailed,
					]}>
						{item.record.syncStatus === "failed" ? "Sync failed" : "Pending"}
					</Text>
				) : null}
			</View>
			<Ionicons color={themeColors.textSecondary} name="chevron-forward" size={18} />
		</Pressable>
	);
}

function RecordRow({
	onPress,
	record,
}: {
	onPress: () => void;
	record: LocalImmunizationRecord;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.scheduleRow}>
			<View style={[styles.checkCircle, styles.checkCircleDone]}>
				<Ionicons color={themeColors.surface} name="checkmark" size={16} />
			</View>
			<View style={styles.rowTextWrap}>
				<Text style={styles.rowTitle}>
					{record.vaccineName}{record.doseLabel ? ` ${record.doseLabel}` : ""}
				</Text>
				<Text style={styles.rowSubtitle}>Given {formatDateKey(record.givenDate)}</Text>
				{record.notes ? <Text style={styles.rowNote}>{record.notes}</Text> : null}
			</View>
			<Ionicons color={themeColors.textSecondary} name="chevron-forward" size={18} />
		</Pressable>
	);
}

function ImmunizationEditorModal({
	editorState,
	onClose,
	onCreate,
	onDelete,
	onUpdate,
	visible,
}: {
	editorState: EditorState | null;
	onClose: () => void;
	onCreate: (input: ImmunizationRecordInput) => Promise<boolean>;
	onDelete: (recordId: string) => Promise<boolean>;
	onUpdate: (recordId: string, input: ImmunizationRecordInput) => Promise<boolean>;
	visible: boolean;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { languagePreference } = useAppPreferences();
	const { selectedBaby } = useBabySelection();
	const timelineTimeZone = useTimelineTimeZone(selectedBaby);
	const [givenDate, setGivenDate] = useState(new Date());
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const [vaccineName, setVaccineName] = useState("");
	const [doseLabel, setDoseLabel] = useState("");
	const [providerName, setProviderName] = useState("");
	const [clinicName, setClinicName] = useState("");
	const [lotNumber, setLotNumber] = useState("");
	const [notes, setNotes] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [isDeleteVisible, setIsDeleteVisible] = useState(false);

	useEffect(() => {
		if (!editorState) return;

		const record = editorState.record;
		const scheduleItem = editorState.mode === "schedule" ? editorState.scheduleItem : undefined;
		setGivenDate(record ? parseDateKey(record.givenDate) : new Date());
		setVaccineName(record?.vaccineName ?? scheduleItem?.vaccineName ?? "");
		setDoseLabel(record?.doseLabel ?? scheduleItem?.doseLabel ?? "");
		setProviderName(record?.providerName ?? "");
		setClinicName(record?.clinicName ?? "");
		setLotNumber(record?.lotNumber ?? "");
		setNotes(record?.notes ?? "");
		setFormError(null);
		setIsPickerOpen(false);
	}, [editorState]);

	if (!editorState) return null;

	const isScheduled = editorState.mode === "schedule";
	const scheduleItem = isScheduled ? editorState.scheduleItem : undefined;
	const record = editorState.record;
	const title = record ? "Edit immunization" : "Record immunization";

	const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setIsPickerOpen(false);
		}

		if (event.type === "dismissed" || !selectedDate) {
			return;
		}

		setGivenDate(selectedDate);
	};

	const save = async () => {
		if (!isScheduled && !vaccineName.trim()) {
			setFormError("Enter a vaccine name.");
			return;
		}

		setIsSaving(true);
		setFormError(null);

		try {
			const input: ImmunizationRecordInput = {
				clinicName,
				doseLabel,
				givenDate: getDateKey(givenDate),
				lotNumber,
				notes,
				providerName,
				scheduleItemId: scheduleItem?.id ?? null,
				vaccineName: isScheduled ? scheduleItem?.vaccineName : vaccineName,
			};
			const didSave = record
				? await onUpdate(record.id, input)
				: await onCreate(input);

			if (didSave) {
				onClose();
			} else {
				setFormError("Could not save immunization record.");
			}
		} catch (error) {
			setFormError(error instanceof Error ? error.message : "Could not save immunization record.");
		} finally {
			setIsSaving(false);
		}
	};

	const remove = async () => {
		if (!record) return;
		setIsSaving(true);
		setFormError(null);

		try {
			const didDelete = await onDelete(record.id);
			if (didDelete) {
				setIsDeleteVisible(false);
				onClose();
			} else {
				setFormError("Could not delete immunization record.");
			}
		} catch (error) {
			setFormError(error instanceof Error ? error.message : "Could not delete immunization record.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Modal animationType="slide" onRequestClose={onClose} visible={visible}>
			<SafeAreaView style={globalStyles.screen}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={styles.modalKeyboardView}
				>
					<View style={styles.modalHeader}>
						<Pressable accessibilityRole="button" onPress={onClose} style={styles.modalHeaderButton}>
							<Text style={styles.cancelText}>Cancel</Text>
						</Pressable>
						<Text style={globalStyles.sectionTitleText}>{title}</Text>
						{record ? (
							<Pressable
								accessibilityRole="button"
								disabled={isSaving}
								onPress={() => setIsDeleteVisible(true)}
								style={styles.modalHeaderButton}
							>
								<Ionicons color={themeColors.error} name="trash-outline" size={22} />
							</Pressable>
						) : (
							<View style={styles.modalHeaderButton} />
						)}
					</View>
					<ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>Vaccine</Text>
							{isScheduled ? (
								<View style={styles.readOnlyField}>
									<Text style={styles.readOnlyText}>{scheduleItem?.vaccineName}</Text>
								</View>
							) : (
								<TextInput
									maxLength={SHORT_FIELD_LIMIT}
									onChangeText={setVaccineName}
									placeholder="Vaccine name"
									placeholderTextColor={themeColors.textSecondary}
									style={styles.textInput}
									value={vaccineName}
								/>
							)}
						</View>
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>Dose</Text>
							<TextInput
								maxLength={DOSE_LIMIT}
								onChangeText={setDoseLabel}
								placeholder="Dose label"
								placeholderTextColor={themeColors.textSecondary}
								style={styles.textInput}
								value={doseLabel}
							/>
						</View>
						{scheduleItem ? (
							<View style={styles.field}>
								<Text style={styles.fieldLabel}>Recommended</Text>
								<View style={styles.readOnlyField}>
									<Text style={styles.readOnlyText}>{scheduleItem.displayAge}</Text>
								</View>
							</View>
						) : null}
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>Given date</Text>
							<Pressable
								accessibilityRole="button"
								onPress={() => setIsPickerOpen(true)}
								style={styles.dateField}
							>
								<Ionicons color={themeColors.textSecondary} name="calendar-outline" size={20} />
								<Text style={styles.dateText}>
									{formatDate(givenDate, timelineTimeZone, languagePreference)}
								</Text>
							</Pressable>
							{isPickerOpen ? (
								<DateTimePicker
									display={Platform.OS === "ios" ? "spinner" : "default"}
									mode="date"
									onChange={handlePickerChange}
									value={givenDate}
								/>
							) : null}
						</View>
						<FormTextInput label="Provider" onChangeText={setProviderName} value={providerName} />
						<FormTextInput label="Clinic" onChangeText={setClinicName} value={clinicName} />
						<FormTextInput
							label="Lot number"
							maxLength={LOT_LIMIT}
							onChangeText={setLotNumber}
							value={lotNumber}
						/>
						<View style={styles.field}>
							<View style={globalStyles.rowBetween}>
								<Text style={styles.fieldLabel}>Notes</Text>
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
							onPress={() => void save()}
							style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
						>
							<Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save"}</Text>
						</Pressable>
					</View>
					<ConfirmDeleteModal
						confirmLabel="Delete"
						message="Delete this immunization record?"
						onCancel={() => setIsDeleteVisible(false)}
						onConfirm={() => void remove()}
						title="Delete record?"
						visible={isDeleteVisible}
					/>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</Modal>
	);
}

function FormTextInput({
	label,
	maxLength = SHORT_FIELD_LIMIT,
	onChangeText,
	value,
}: {
	label: string;
	maxLength?: number;
	onChangeText: (value: string) => void;
	value: string;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				maxLength={maxLength}
				onChangeText={onChangeText}
				placeholder="Optional"
				placeholderTextColor={themeColors.textSecondary}
				style={styles.textInput}
				value={value}
			/>
		</View>
	);
}

function ProfileModal({
	currentProfile,
	onClose,
	onSelect,
	visible,
}: {
	currentProfile: ImmunizationScheduleProfile;
	onClose: () => void;
	onSelect: (profile: ImmunizationScheduleProfile) => void;
	visible: boolean;
}) {
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const insets = useSafeAreaInsets();
	return (
		<Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
			<View style={[styles.profileModalBackdrop, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
				<View style={[globalStyles.card, styles.profileModalCard]}>
					<View style={globalStyles.rowBetween}>
						<Text style={styles.profileModalTitle}>Schedule guideline</Text>
						<Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
							<Ionicons color={themeColors.textSecondary} name="close" size={20} />
						</Pressable>
					</View>
					{PROFILE_OPTIONS.map((profile) => {
						const details = PROFILE_DETAILS[profile];

						return (
							<ProfileOption
								active={currentProfile === profile}
								asOfText={details.asOfText}
								helperTone={details.helperTone}
								key={profile}
								label={details.label}
								onPress={() => onSelect(profile)}
								subtitle={details.subtitle}
							/>
						);
					})}
				</View>
			</View>
		</Modal>
	);
}

function ProfileOption({
	active = false,
	asOfText,
	helperTone = "warning",
	label,
	onPress,
	subtitle,
}: {
	active?: boolean;
	asOfText: string;
	helperTone?: "info" | "warning";
	label: string;
	onPress: () => void;
	subtitle: string;
}) {
	const { themeColors, styles } = useThemeStyles();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={styles.profileOption}
		>
			<View style={styles.rowTextWrap}>
				<Text style={styles.rowTitle}>{label}</Text>
				<Text style={styles.rowSubtitle}>{subtitle}</Text>
				<Text style={[
					styles.profileOptionHelper,
					helperTone === "warning" ? styles.profileOptionHelperWarning : styles.profileOptionHelperInfo,
				]}>
					{asOfText}
				</Text>
			</View>
			{active ? <Ionicons color={themeColors.primary} name="checkmark-circle" size={22} /> : null}
		</Pressable>
	);
}

function formatBabyAge(dateKey: string) {
	const birthdate = parseDateKey(dateKey);
	const today = new Date();
	let months = getAgeMonths(dateKey);
	const monthAnchor = new Date(birthdate);
	monthAnchor.setMonth(birthdate.getMonth() + months);
	const days = Math.max(0, Math.floor((today.getTime() - monthAnchor.getTime()) / 86400000));

	if (months <= 0) {
		return `${days} days`;
	}

	return `${months} months, ${days} days`;
}

function getDateKey(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function formatDateKey(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(parseDateKey(value));
}

function formatDate(value: Date, timeZone?: string, locale = "en-US") {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone,
		year: "numeric",
	}).format(value);
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		addCustomButton: {
			alignItems: "center",
			borderColor: themeColors.border,
			borderRadius: 14,
			borderStyle: "dashed",
			borderWidth: 1,
			flexDirection: "row",
			gap: spacing.sm,
			justifyContent: "center",
			padding: spacing.md,
		},
		addCustomText: {
			color: themeColors.primary,
			fontSize: 15,
			fontWeight: "800",
		},
		cancelText: {
			color: themeColors.primary,
			fontSize: 15,
			fontWeight: "700",
		},
		checkCircle: {
			alignItems: "center",
			borderColor: themeColors.border,
			borderRadius: 12,
			borderWidth: 2,
			height: 24,
			justifyContent: "center",
			width: 24,
		},
		checkCircleDone: {
			backgroundColor: themeColors.success,
			borderColor: themeColors.success,
		},
		closeButton: {
			alignItems: "center",
			height: 32,
			justifyContent: "center",
			width: 32,
		},
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		countGrid: {
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.md,
		},
		countLabel: {
			color: "#6B7280",
			fontSize: 11,
			fontWeight: "700",
		},
		countPill: {
			borderRadius: 14,
			flex: 1,
			gap: 2,
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.sm,
		},
		countValue: {
			color: "#151827",
			fontSize: 18,
			fontWeight: "900",
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
		disclaimerCard: {
			alignItems: "flex-start",
			flexDirection: "row",
			gap: spacing.sm,
		},
		disclaimerText: {
			...typography.body,
			color: themeColors.textSecondary,
			flex: 1,
		},
		donePill: {
			backgroundColor: "#EAF8EF",
		},
		duePill: {
			backgroundColor: "#F1ECFF",
		},
		emptyTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
			marginBottom: spacing.xs,
		},
		errorText: {
			color: themeColors.error,
			fontSize: 13,
			fontWeight: "700",
			marginBottom: spacing.sm,
		},
		field: {
			gap: spacing.sm,
		},
		fieldLabel: {
			color: themeColors.textPrimary,
			fontSize: 15,
			fontWeight: "800",
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
			alignItems: "center",
			height: 40,
			justifyContent: "center",
			minWidth: 40,
		},
		listWrap: {
			gap: spacing.sm,
			marginTop: spacing.md,
		},
		modalContent: {
			gap: spacing.lg,
			padding: spacing.md,
		},
		modalHeader: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "space-between",
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.md,
		},
		modalHeaderButton: {
			alignItems: "center",
			minWidth: 72,
			paddingVertical: spacing.sm,
		},
		modalKeyboardView: {
			flex: 1,
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
		pastDuePill: {
			backgroundColor: "#FEE2E2",
		},
		profileModalBackdrop: {
			backgroundColor: "#00000066",
			flex: 1,
			justifyContent: "flex-end",
			padding: spacing.md,
		},
		profileModalCard: {
			gap: spacing.sm,
			paddingBottom: spacing.lg,
		},
		profileModalTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
		profileOption: {
			alignItems: "center",
			borderColor: themeColors.border,
			borderRadius: 14,
			borderWidth: 1,
			flexDirection: "row",
			gap: spacing.md,
			minHeight: 64,
			padding: spacing.md,
		},
		profileOptionHelper: {
			fontSize: 12,
			fontWeight: "800",
			marginTop: spacing.xs,
		},
		profileOptionHelperInfo: {
			color: themeColors.primary,
		},
		profileOptionHelperWarning: {
			color: "#B45309",
		},
		profileText: {
			color: themeColors.primary,
			fontSize: 13,
			fontWeight: "800",
			marginTop: spacing.xs,
		},
		readOnlyField: {
			backgroundColor: themeColors.background,
			borderColor: themeColors.border,
			borderRadius: 14,
			borderWidth: 1,
			padding: spacing.md,
		},
		readOnlyText: {
			color: themeColors.textPrimary,
			fontSize: 16,
			fontWeight: "800",
		},
		rowNote: {
			color: themeColors.textSecondary,
			fontSize: 12,
			fontWeight: "600",
			lineHeight: 17,
			marginTop: 3,
		},
		rowSubtitle: {
			...typography.caption,
			color: themeColors.textSecondary,
			marginTop: 2,
		},
		rowTextWrap: {
			flex: 1,
		},
		rowTitle: {
			...typography.itemTitle,
			color: themeColors.textPrimary,
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
		scheduleRow: {
			alignItems: "center",
			borderColor: themeColors.border,
			borderRadius: 14,
			borderWidth: 1,
			flexDirection: "row",
			gap: spacing.md,
			minHeight: 64,
			padding: spacing.md,
		},
		sectionCount: {
			color: themeColors.textSecondary,
			fontSize: 12,
			fontWeight: "800",
		},
		sectionHeader: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "space-between",
		},
		sectionHeaderRight: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.xs,
		},
		sectionTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
		summaryIcon: {
			alignItems: "center",
			backgroundColor: themeColors.secondary,
			borderRadius: 18,
			height: 52,
			justifyContent: "center",
			width: 52,
		},
		summaryText: {
			flex: 1,
		},
		summaryTitle: {
			...typography.screenTitle,
			color: themeColors.textPrimary,
		},
		syncBadge: {
			alignSelf: "flex-start",
			backgroundColor: "#F1EFFD",
			borderRadius: 999,
			color: themeColors.primary,
			fontSize: 11,
			fontWeight: "800",
			marginTop: spacing.xs,
			overflow: "hidden",
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.xs,
		},
		syncBadgeFailed: {
			backgroundColor: "#FEE2E2",
			color: themeColors.error,
		},
		syncCard: {
			backgroundColor: "#FEF2F2",
		},
		syncText: {
			color: themeColors.error,
			fontSize: 13,
			fontWeight: "700",
		},
		textInput: {
			backgroundColor: themeColors.surface,
			borderColor: themeColors.border,
			borderRadius: 14,
			borderWidth: 1,
			color: themeColors.textPrimary,
			fontSize: 16,
			fontWeight: "700",
			padding: spacing.md,
		},
		upcomingGroup: {
			gap: spacing.sm,
		},
		upcomingGroupTitle: {
			...typography.caption,
			color: themeColors.textSecondary,
			textTransform: "uppercase",
		},
	});
}
