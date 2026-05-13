import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { DiaryMedia } from "@/services/api/diary";
import { colors, spacing, typography } from "@/styles/globalStyles";

type DiaryMediaPreviewProps = {
	media: DiaryMedia[];
	variant?: "card" | "detail";
};

export function DiaryMediaPreview({ media, variant = "card" }: DiaryMediaPreviewProps) {
	if (media.length === 0) {
		return null;
	}

	const visibleMedia = media.slice(0, variant === "detail" ? 6 : 2);
	const hiddenCount = Math.max(media.length - visibleMedia.length, 0);

	return (
		<View style={styles.container}>
			{visibleMedia.map((item, index) => (
				<View
					key={item.id}
					style={[
						styles.placeholder,
						variant === "detail" ? styles.detailPlaceholder : styles.cardPlaceholder,
					]}
				>
					<Ionicons
						color={colors.light.textSecondary}
						name={isVideo(item.fileType) ? "play-circle-outline" : "image-outline"}
						size={24}
					/>
					<Text numberOfLines={1} style={styles.mediaText}>
						{item.description || getMediaLabel(item.fileType, index)}
					</Text>
				</View>
			))}
			{hiddenCount > 0 ? (
				<View style={[styles.placeholder, styles.countPlaceholder]}>
					<Text style={styles.countText}>+{hiddenCount}</Text>
				</View>
			) : null}
		</View>
	);
}

function getMediaLabel(fileType: string, index: number) {
	const type = isVideo(fileType) ? "Video" : "Photo";
	return `${type} ${index + 1}`;
}

function isVideo(fileType: string) {
	return fileType.toLowerCase().startsWith("video/");
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	placeholder: {
		alignItems: "center",
		backgroundColor: "#F7F8FC",
		borderColor: colors.light.border,
		borderRadius: 10,
		borderWidth: 1,
		justifyContent: "center",
		overflow: "hidden",
		padding: spacing.sm,
	},
	cardPlaceholder: {
		flex: 1,
		minHeight: 82,
		minWidth: 120,
	},
	countPlaceholder: {
		minHeight: 82,
		minWidth: 54,
	},
	countText: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	detailPlaceholder: {
		aspectRatio: 1.3,
		width: "48%",
	},
	mediaText: {
		...typography.caption,
		color: colors.light.textSecondary,
		marginTop: spacing.xs,
		textAlign: "center",
	},
});
