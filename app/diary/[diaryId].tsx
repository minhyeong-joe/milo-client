import { DiaryMediaPreview } from "@/components/diary/DiaryMediaPreview";
import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import type { DiaryEntry } from "@/services/api/diary";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DiaryDetailScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ diaryId: string; entry?: string }>();
	const entry = parseEntryParam(params.entry);

	return (
		<SafeAreaView edges={["top", "left", "right"]} style={globalStyles.screen}>
			<View style={styles.header}>
				<Pressable
					accessibilityLabel="Go back"
					hitSlop={10}
					onPress={() => router.back()}
					style={styles.iconButton}
				>
					<Ionicons color={colors.light.textPrimary} name="chevron-back" size={24} />
				</Pressable>
				<Text style={styles.headerTitle}>Diary</Text>
				<Pressable
					accessibilityLabel="Diary actions"
					hitSlop={10}
					onPress={() => undefined}
					style={styles.iconButton}
				>
					<Ionicons color={colors.light.textSecondary} name="ellipsis-horizontal" size={22} />
				</Pressable>
			</View>

			<ScrollView contentContainerStyle={[globalStyles.scrollContent, styles.content]}>
				{entry ? (
					<View style={[globalStyles.card, globalStyles.shadowCard, styles.detailCard]}>
						<Text style={styles.dateText}>{formatDateLabel(entry.diaryDate)}</Text>

						{entry.tags.length > 0 ? (
							<View style={styles.tagRow}>
								{entry.tags.map((tag) => (
									<DiaryTagPill key={tag.id} tag={tag} />
								))}
							</View>
						) : null}

						<Text style={styles.contentText}>{entry.content}</Text>

						{entry.media.length > 0 ? (
							<View>
								<DiaryMediaPreview media={entry.media} variant="detail" />
							</View>
						) : null}

						<View style={styles.metadataCard}>
							<MetadataRow label="Created by" value={formatUser(entry.createdBy, entry.createdById)} />
							<MetadataRow label="Created at" value={formatDateTime(entry.createdAt)} />
							<MetadataRow label="Modified by" value={formatUser(entry.updatedBy, entry.updatedById)} />
							<MetadataRow label="Modified at" value={formatDateTime(entry.updatedAt)} />
						</View>
					</View>
				) : (
					<View style={globalStyles.card}>
						<Text style={globalStyles.sectionTitleText}>Entry not loaded</Text>
						<Text style={globalStyles.bodyText}>
							Go back to Diary and open this entry again.
						</Text>
					</View>
				)}
			</ScrollView>
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
	},
	iconButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	metadataCard: {
		gap: spacing.xs,
		padding: spacing.sm,
	},
	metadataLabel: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	metadataRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	metadataValue: {
		...typography.caption,
		color: colors.light.textPrimary,
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
