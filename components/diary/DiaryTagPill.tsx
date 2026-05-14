import { StyleSheet, Text, View } from "react-native";
import type { DiaryTag } from "@/services/api/diary";
import { spacing, typography } from "@/styles/globalStyles";

export function DiaryTagPill({ tag }: { tag: Pick<DiaryTag, "color" | "name"> }) {
	return (
		<View style={[styles.pill, { backgroundColor: getTagBackground(tag.color) }]}>
			<Text style={[styles.text, { color: tag.color }]}>{tag.name}</Text>
		</View>
	);
}

function getTagBackground(color: string) {
	if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
		return "#F7F8FC";
	}

	return `${color}1F`;
}

const styles = StyleSheet.create({
	pill: {
		alignSelf: "flex-start",
		borderRadius: 999,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	text: {
		...typography.caption,
		fontSize: 14,
	},
});
