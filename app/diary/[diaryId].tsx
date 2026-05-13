import { DiaryActionsModal } from "@/components/diary/DiaryActionsModal";
import { DiaryMediaPreview } from "@/components/diary/DiaryMediaPreview";
import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import { ConfirmDeleteModal } from "@/components/routine/ConfirmDeleteModal";
import { useBabySelection } from "@/context/BabySelectionContext";
import { deleteDiaryEntry, type DiaryEntry } from "@/services/api/diary";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function DiaryDetailScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ diaryId: string; entry?: string }>();
	const { selectedBaby } = useBabySelection();
	const entry = parseEntryParam(params.entry);
	const [isActionsVisible, setIsActionsVisible] = useState(false);
	const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
	const [isMetadataVisible, setIsMetadataVisible] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const insets = useSafeAreaInsets();
	const footerBottomPadding = Math.max(insets.bottom, 12);

	const openEdit = () => {
		if (!entry) {
			return;
		}

		setIsActionsVisible(false);
		router.push({
			pathname: "/diary/edit",
			params: {
				entry: encodeURIComponent(JSON.stringify(entry)),
			},
		});
	};

	const requestDelete = () => {
		setIsActionsVisible(false);
		setIsDeleteModalVisible(true);
	};

	const confirmDelete = async () => {
		if (!selectedBaby || !entry) {
			return;
		}

		setIsDeleting(true);

		try {
			await deleteDiaryEntry(selectedBaby.id, entry.id);
			setIsDeleteModalVisible(false);
			router.replace("/(tabs)/diary");
		} catch (error) {
			console.warn(error);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={{...globalStyles.screen, paddingBottom: footerBottomPadding}}>
			<View style={styles.header}>
				<Pressable
					accessibilityLabel="Go back"
					hitSlop={10}
					onPress={() => router.back()}
					style={styles.iconButton}
				>
					<Ionicons color={colors.light.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Pressable
					accessibilityRole="button"
					disabled={!entry}
					onPress={() => setIsMetadataVisible(true)}
					style={styles.dateButton}
				>
					<Text style={styles.headerTitle}>
						{entry ? formatDateLabel(entry.diaryDate) : "Diary"}
					</Text>
					<Ionicons color={colors.light.textSecondary} name="information-circle-outline" size={16} />
				</Pressable>
				<Pressable
					accessibilityLabel="Diary actions"
					hitSlop={10}
					onPress={() => setIsActionsVisible(true)}
					style={styles.iconButton}
				>
					<Ionicons color={colors.light.textSecondary} name="ellipsis-horizontal" size={22} />
				</Pressable>
			</View>

			<ScrollView contentContainerStyle={[globalStyles.scrollContent, styles.content]}>
				{entry ? (
					<>
						<View style={[globalStyles.card, globalStyles.shadowCard, styles.detailCard]}>
							{entry.tags.length > 0 ? (
								<View style={styles.tagRow}>
									{entry.tags.map((tag) => (
										<DiaryTagPill key={tag.id} tag={tag} />
									))}
								</View>
							) : null}

							<Text style={styles.contentText}>{entry.content}</Text>
						</View>
						{entry.media.length > 0 ? (
							<View style={styles.mediaSection}>
								<DiaryMediaPreview media={entry.media} variant="detail" />
							</View>
						) : null}
					</>
				) : (
					<View style={globalStyles.card}>
						<Text style={globalStyles.sectionTitleText}>Entry not loaded</Text>
						<Text style={globalStyles.bodyText}>
							Go back to Diary and open this entry again.
						</Text>
					</View>
				)}
			</ScrollView>
			<DiaryActionsModal
				onClose={() => setIsActionsVisible(false)}
				onDelete={requestDelete}
				onEdit={openEdit}
				visible={Boolean(entry) && isActionsVisible}
			/>
			<ConfirmDeleteModal
				confirmLabel={isDeleting ? "Deleting..." : "Delete"}
				message="Are you sure you want to delete this diary entry permanently?"
				onCancel={() => setIsDeleteModalVisible(false)}
				onConfirm={() => void confirmDelete()}
				title="Delete diary entry?"
				visible={Boolean(entry) && isDeleteModalVisible}
			/>
			<Modal
				animationType="fade"
				onRequestClose={() => setIsMetadataVisible(false)}
				transparent
				visible={Boolean(entry) && isMetadataVisible}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => setIsMetadataVisible(false)}
					style={styles.metadataBackdrop}
				>
					<Pressable style={styles.metadataPopover}>
						<Text style={globalStyles.sectionTitleText}>Entry history</Text>
						{entry ? (
							<>
								<MetadataRow label="Created by" value={formatUser(entry.createdBy, entry.createdById)} />
								<MetadataRow label="Created at" value={formatDateTime(entry.createdAt)} />
								<MetadataRow label="Modified by" value={formatUser(entry.updatedBy, entry.updatedById)} />
								<MetadataRow label="Modified at" value={formatDateTime(entry.updatedAt)} />
							</>
						) : null}
					</Pressable>
				</Pressable>
			</Modal>
		</SafeAreaView>
	);
}

function MetadataRow({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.metadataRow}>
			<Text style={styles.metadataLabel}>{label}</Text>
			<Text numberOfLines={1} style={styles.metadataValue}>
				{value}
			</Text>
		</View>
	);
}

function parseEntryParam(value: string | undefined) {
	if (!value) {
		return null;
	}

	try {
		return JSON.parse(decodeURIComponent(value)) as DiaryEntry;
	} catch (error) {
		console.warn(error);
		return null;
	}
}

function formatDateTime(value: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function formatDateLabel(dateKey: string) {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		weekday: "long",
		year: "numeric",
	}).format(date);
}

function formatUser(
	user: DiaryEntry["createdBy"] | DiaryEntry["updatedBy"] | undefined,
	fallbackId: string,
) {
	if (user?.displayName) {
		return user.displayName;
	}

	if (user?.email) {
		return user.email;
	}

	return fallbackId;
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
	},
	contentText: {
		...typography.body,
		color: colors.light.textPrimary,
		fontSize: 16,
		lineHeight: 24,
	},
	dateText: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	dateButton: {
		alignItems: "center",
		flexDirection: "row",
		flex: 1,
		gap: spacing.xs,
		justifyContent: "center",
		minWidth: 0,
	},
	detailCard: {
		gap: spacing.md,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	headerTitle: {
		...typography.sectionTitle,
		color: colors.light.textPrimary,
		flexShrink: 1,
		textAlign: "center",
	},
	iconButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	mediaSection: {
		marginTop: spacing.md,
	},
	metadataBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.35)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	metadataLabel: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	metadataRow: {
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
	},
	metadataValue: {
		...typography.caption,
		color: colors.light.textPrimary,
		flex: 1,
		textAlign: "right",
	},
	metadataPopover: {
		backgroundColor: colors.light.surface,
		borderRadius: 18,
		gap: spacing.sm,
		padding: spacing.lg,
		width: "100%",
	},
	sectionLabel: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	tagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
});
