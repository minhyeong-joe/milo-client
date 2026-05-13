import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DiaryMediaPreview } from "@/components/diary/DiaryMediaPreview";
import { DiaryTagPill } from "@/components/diary/DiaryTagPill";
import type { DiaryEntry } from "@/services/api/diary";
import { colors, globalStyles, spacing, typography } from "@/styles/globalStyles";

type DiaryEntryCardProps = {
	entry: DiaryEntry;
	onPress: (entry: DiaryEntry) => void;
	onMorePress?: (entry: DiaryEntry) => void;
	todayDate: string;
};

export function DiaryEntryCard({
	entry,
	onMorePress,
	onPress,
	todayDate,
}: DiaryEntryCardProps) {
	const hasSingleMedia = entry.media.length === 1;

	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => onPress(entry)}
			style={({ pressed }) => [
				globalStyles.card,
				globalStyles.shadowCard,
				styles.card,
				pressed && styles.pressed,
			]}
		>
			<View style={styles.headerRow}>
				<Text style={styles.dateText}>
					{formatDateLabel(entry.diaryDate)}
					{entry.diaryDate === todayDate ? " · Today" : ""}
				</Text>
				<Pressable
					accessibilityLabel="Diary actions"
					hitSlop={10}
					onPress={(event) => {
						event.stopPropagation();
						onMorePress?.(entry);
					}}
					style={styles.moreButton}
				>
					<Ionicons color={colors.light.textSecondary} name="ellipsis-horizontal" size={18} />
				</Pressable>
			</View>
			{hasSingleMedia ? (
				<View style={styles.singleMediaLayout}>
					<View style={styles.singleMediaTextColumn}>
						<CardTextContent
							entry={entry}
							onMorePress={onMorePress}
							todayDate={todayDate}
						/>
					</View>
					<DiaryMediaPreview media={entry.media} variant="singleCard" />
				</View>
			) : (
				<>
					<CardTextContent
						entry={entry}
						onMorePress={onMorePress}
						todayDate={todayDate}
					/>
					{entry.media.length > 1 ? <DiaryMediaPreview media={entry.media} /> : null}
				</>
			)}
		</Pressable>
	);
}

function CardTextContent({
	entry,
	onMorePress,
	todayDate,
}: {
	entry: DiaryEntry;
	onMorePress?: (entry: DiaryEntry) => void;
	todayDate: string;
}) {
	return (
		<>
			{entry.tags.length > 0 ? (
				<View style={styles.tagRow}>
					{entry.tags.slice(0, 4).map((tag) => (
						<DiaryTagPill key={tag.id} tag={tag} />
					))}
				</View>
			) : null}

			<Text numberOfLines={3} style={styles.contentText}>
				{entry.content}
			</Text>
		</>
	);
}

function formatDateLabel(dateKey: string) {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(date);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: 14,
		gap: spacing.sm,
	},
	contentText: {
		...typography.body,
		color: colors.light.textPrimary,
	},
	dateText: {
		...typography.caption,
		color: colors.light.textSecondary,
	},
	headerRow: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	moreButton: {
		alignItems: "center",
		height: 28,
		justifyContent: "center",
		width: 28,
	},
	pressed: {
		opacity: 0.82,
	},
	singleMediaLayout: {
		alignItems: "stretch",
		flexDirection: "row",
		gap: spacing.md,
	},
	singleMediaTextColumn: {
		flex: 1,
		gap: spacing.sm,
		minWidth: 0,
	},
	tagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
});
