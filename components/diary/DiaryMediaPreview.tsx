import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
	Image,
	Linking,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

import type { DiaryMedia } from "@/services/api/diary";
import { colors, spacing, typography } from "@/styles/globalStyles";

export type DiaryMediaPreviewItem = Pick<
	DiaryMedia,
	| "description"
	| "fileType"
	| "objectKey"
	| "sizeBytes"
	| "thumbnailFileType"
	| "thumbnailObjectKey"
	| "thumbnailSizeBytes"
> & {
	diaryId?: string;
	id?: string;
	localUri?: string;
	mediaUrl?: string | null;
	thumbnailUrl?: string | null;
	thumbnailLocalUri?: string | null;
};

type DiaryMediaPreviewProps = {
	media: DiaryMediaPreviewItem[];
	onRemove?: (objectKey: string) => void;
	variant?: "card" | "detail" | "form" | "singleCard";
};

type ImageRatioBucket = "horizontal" | "square" | "vertical";

export function DiaryMediaPreview({
	media,
	onRemove,
	variant = "card",
}: DiaryMediaPreviewProps) {
	const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

	if (media.length === 0) {
		return null;
	}

	const limit = getVisibleMediaLimit(variant);
	const visibleMedia = limit ? media.slice(0, limit) : media;
	const hiddenCount = limit ? Math.max(media.length - visibleMedia.length, 0) : 0;
	const content = (
		<>
			{visibleMedia.map((item) => (
				<MediaTile
					item={item}
					key={item.id ?? item.objectKey}
					onOpenImage={setSelectedImageUri}
					onRemove={onRemove}
					variant={variant}
				/>
			))}
			{hiddenCount > 0 ? (
				<View style={styles.countPlaceholder}>
					<Text style={styles.countText}>+{hiddenCount}</Text>
				</View>
			) : null}
		</>
	);

	return (
		<>
			{variant === "form" ? (
				<ScrollView
					contentContainerStyle={styles.formContainer}
					horizontal
					showsHorizontalScrollIndicator={false}
				>
					{content}
				</ScrollView>
			) : (
				<View style={[styles.container, variant === "singleCard" && styles.singleContainer]}>
					{content}
				</View>
			)}
			<Modal
				animationType="fade"
				onRequestClose={() => setSelectedImageUri(null)}
				transparent
				visible={Boolean(selectedImageUri)}
			>
				<Pressable
					accessibilityRole="button"
					onPress={() => setSelectedImageUri(null)}
					style={styles.imageModalBackdrop}
				>
					{selectedImageUri ? (
						<Image source={{ uri: selectedImageUri }} style={styles.fullImage} />
					) : null}
				</Pressable>
			</Modal>
		</>
	);
}

function MediaTile({
	item,
	onOpenImage,
	onRemove,
	variant,
}: {
	item: DiaryMediaPreviewItem;
	onOpenImage: (uri: string) => void;
	onRemove?: (objectKey: string) => void;
	variant: NonNullable<DiaryMediaPreviewProps["variant"]>;
}) {
	const imageUri = !isVideo(item.fileType)
		? item.mediaUrl ?? item.localUri ?? null
		: item.thumbnailUrl ?? item.thumbnailLocalUri ?? null;
	const ratioBucket = useImageRatioBucket(imageUri);
	const tileStyle = useMemo(
		() => [
			styles.mediaCard,
			getVariantStyle(variant),
			getRatioStyle(variant, ratioBucket),
		],
		[ratioBucket, variant],
	);

	return (
		<Pressable
			onPress={() => {
				if (variant === "detail" || variant === "form") {
					if (isVideo(item.fileType) && item.mediaUrl) {
						void Linking.openURL(item.mediaUrl);
						return;
					}
	
					if (imageUri) {
						onOpenImage(imageUri);
					}
				}
			}}
			style={tileStyle}
		>
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.previewImage} />
			) : (
				<Ionicons
					color={colors.light.textSecondary}
					name={isVideo(item.fileType) ? "play-circle-outline" : "image-outline"}
					size={28}
				/>
			)}
			{isVideo(item.fileType) ? (
				<View style={styles.videoBadge}>
					<Ionicons color={colors.light.surface} name="play" size={12} />
					<Text style={styles.videoBadgeText}>Video</Text>
				</View>
			) : null}
			{onRemove ? (
				<Pressable
					accessibilityLabel="Remove media"
					onPress={() => onRemove(item.objectKey)}
					style={styles.removeButton}
				>
					<Ionicons color={colors.light.surface} name="close" size={14} />
				</Pressable>
			) : null}
		</Pressable>
	);
}

function getRatioStyle(
	variant: NonNullable<DiaryMediaPreviewProps["variant"]>,
	ratioBucket: ImageRatioBucket,
) {
	if (variant === "singleCard") {
		return styles.singleCardMedia;
	}

	if (variant === "form") {
		if (ratioBucket === "vertical") {
			return styles.formVerticalMedia;
		}

		if (ratioBucket === "horizontal") {
			return styles.formHorizontalMedia;
		}

		return styles.formSquareMedia;
	}

	if (variant === "detail") {
		if (ratioBucket === "vertical") {
			return styles.detailVerticalMedia;
		}

		if (ratioBucket === "horizontal") {
			return styles.detailHorizontalMedia;
		}

		return styles.detailSquareMedia;
	}

	if (ratioBucket === "vertical") {
		return styles.cardVerticalMedia;
	}

	return styles.cardMedia;
}

function getVariantStyle(variant: NonNullable<DiaryMediaPreviewProps["variant"]>) {
	if (variant === "singleCard") {
		return styles.singleCardMedia;
	}

	return null;
}

function getVisibleMediaLimit(variant: NonNullable<DiaryMediaPreviewProps["variant"]>) {
	if (variant === "card") {
		return 2;
	}

	if (variant === "singleCard") {
		return 1;
	}

	return null;
}

function isVideo(fileType: string) {
	return fileType.toLowerCase().startsWith("video/");
}

function useImageRatioBucket(uri: string | null): ImageRatioBucket {
	const [ratioBucket, setRatioBucket] = useState<ImageRatioBucket>("square");

	useEffect(() => {
		if (!uri) {
			setRatioBucket("square");
			return;
		}

		let isMounted = true;

		Image.getSize(
			uri,
			(width, height) => {
				if (!isMounted || width <= 0 || height <= 0) {
					return;
				}

				const ratio = width / height;
				if (ratio > 1.25) {
					setRatioBucket("horizontal");
				} else if (ratio < 0.8) {
					setRatioBucket("vertical");
				} else {
					setRatioBucket("square");
				}
			},
			() => {
				if (isMounted) {
					setRatioBucket("square");
				}
			},
		);

		return () => {
			isMounted = false;
		};
	}, [uri]);

	return ratioBucket;
}

const styles = StyleSheet.create({
	cardMedia: {
		height: 96,
		width: 144,
	},
	cardVerticalMedia: {
		height: 112,
		width: 90,
	},
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	countPlaceholder: {
		alignItems: "center",
		height: 96,
		justifyContent: "center",
		minWidth: 54,
		overflow: "hidden",
	},
	countText: {
		...typography.label,
		color: colors.light.textPrimary,
	},
	detailHorizontalMedia: {
		height: 180,
		width: "100%",
	},
	detailSquareMedia: {
		aspectRatio: 1,
		width: "48%",
	},
	detailVerticalMedia: {
		aspectRatio: 0.72,
		width: "48%",
	},
	formContainer: {
		gap: spacing.sm,
		marginTop: spacing.sm,
		paddingRight: spacing.md,
	},
	formHorizontalMedia: {
		height: 108,
		width: 162,
	},
	formSquareMedia: {
		height: 108,
		width: 108,
	},
	formVerticalMedia: {
		height: 132,
		width: 96,
	},
	fullImage: {
		height: "100%",
		resizeMode: "contain",
		width: "100%",
	},
	imageModalBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.92)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	mediaCard: {
		alignItems: "center",
		backgroundColor: "#F7F8FC",
		borderColor: colors.light.border,
		borderRadius: 8,
		borderWidth: 1,
		justifyContent: "center",
		overflow: "hidden",
	},
	previewImage: {
		...StyleSheet.absoluteFillObject,
		height: "100%",
		resizeMode: "cover",
		width: "100%",
	},
	removeButton: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.72)",
		borderRadius: 999,
		height: 24,
		justifyContent: "center",
		position: "absolute",
		right: spacing.xs,
		top: spacing.xs,
		width: 24,
	},
	singleCardMedia: {
		height: 112,
		marginTop: 0,
		width: 112,
	},
	singleContainer: {
		flexShrink: 0,
		marginTop: 0,
	},
	videoBadge: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.72)",
		borderRadius: 999,
		bottom: spacing.xs,
		flexDirection: "row",
		gap: 2,
		paddingHorizontal: spacing.sm,
		paddingVertical: 3,
		position: "absolute",
		right: spacing.xs,
	},
	videoBadgeText: {
		...typography.caption,
		color: colors.light.surface,
		fontSize: 10,
	},
});
