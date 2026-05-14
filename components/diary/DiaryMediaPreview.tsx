import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Image,
	Modal,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	useWindowDimensions,
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
	onMediaPress?: (item: DiaryMediaPreviewItem) => void;
	onRemove?: (objectKey: string) => void;
	variant?: "card" | "detail" | "form" | "singleCard";
};

type ImageRatioBucket = "horizontal" | "square" | "vertical";

export function DiaryMediaPreview({
	media,
	onMediaPress,
	onRemove,
	variant = "card",
}: DiaryMediaPreviewProps) {
	const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
	const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
	const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);
	const cardVisibleMediaLimit = useCardVisibleMediaLimit(media, variant);

	if (media.length === 0) {
		return null;
	}

	const limit = cardVisibleMediaLimit ?? getVisibleMediaLimit(variant);
	const visibleMedia = limit ? media.slice(0, limit) : media;
	const hiddenCount = limit ? Math.max(media.length - visibleMedia.length, 0) : 0;
	const content = (
		<>
			{visibleMedia.map((item, index) => (
				<MediaTile
					index={index}
					item={item}
					key={item.id ?? item.objectKey}
					onOpenGallery={setSelectedGalleryIndex}
					onMediaPress={onMediaPress}
					onOpenImage={setSelectedImageUri}
					onOpenVideo={setSelectedVideoUri}
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
			{variant === "form" || variant === "detail" ? (
				<ScrollView
					contentContainerStyle={[
						styles.formContainer,
						variant === "detail" && styles.detailScrollContainer,
					]}
					horizontal
					showsHorizontalScrollIndicator={false}
				>
					{content}
				</ScrollView>
			) : (
				<View
					style={[
						styles.container,
						variant === "singleCard" && styles.singleContainer,
					]}
				>
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
			{selectedVideoUri ? (
				<VideoModal onClose={() => setSelectedVideoUri(null)} uri={selectedVideoUri} />
			) : null}
			{selectedGalleryIndex !== null ? (
				<FullscreenMediaGallery
					index={selectedGalleryIndex}
					media={media}
					onClose={() => setSelectedGalleryIndex(null)}
					onIndexChange={setSelectedGalleryIndex}
				/>
			) : null}
		</>
	);
}

export function DiaryHeroCarousel({ media }: { media: DiaryMediaPreviewItem[] }) {
	const [activeIndex, setActiveIndex] = useState(0);
	const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);
	const { width } = useWindowDimensions();
	const heroWidth = Math.max(width - spacing.md * 2, 280);

	if (media.length === 0) {
		return null;
	}

	const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const nextIndex = Math.round(event.nativeEvent.contentOffset.x / heroWidth);

		if (nextIndex >= 0 && nextIndex < media.length) {
			setActiveIndex(nextIndex);
		}
	};

	return (
		<View style={styles.heroWrap}>
			<ScrollView
				horizontal
				onMomentumScrollEnd={handleMomentumScrollEnd}
				pagingEnabled
				scrollEventThrottle={16}
				showsHorizontalScrollIndicator={false}
				style={styles.heroPager}
			>
				{media.map((item, index) => (
					<Pressable
						accessibilityRole="imagebutton"
						key={item.id ?? item.objectKey}
						onPress={() => setSelectedGalleryIndex(index)}
						style={[styles.heroPage, { width: heroWidth }]}
					>
						<HeroMedia item={item} />
						<View style={styles.heroCountBadge}>
							<Text style={styles.heroCountText}>
								{index + 1} / {media.length}
							</Text>
						</View>
					</Pressable>
				))}
			</ScrollView>
			{media.length > 1 ? (
				<View style={styles.heroDots}>
					{media.map((item, index) => (
						<View
							key={item.id ?? item.objectKey}
							style={[
								styles.heroDot,
								index === activeIndex && styles.heroDotActive,
							]}
						/>
					))}
				</View>
			) : null}
			{selectedGalleryIndex !== null ? (
				<FullscreenMediaGallery
					index={selectedGalleryIndex}
					media={media}
					onClose={() => setSelectedGalleryIndex(null)}
					onIndexChange={(index) => {
						setActiveIndex(index);
						setSelectedGalleryIndex(index);
					}}
				/>
			) : null}
		</View>
	);
}

function HeroMedia({ item }: { item: DiaryMediaPreviewItem }) {
	const imageUri = getMediaPreviewUri(item);

	return (
		<View style={styles.heroMedia}>
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.heroImage} />
			) : (
				<Ionicons
					color={colors.light.textSecondary}
					name={isVideo(item.fileType) ? "play-circle-outline" : "image-outline"}
					size={42}
				/>
			)}
			{isVideo(item.fileType) ? (
				<View style={styles.heroPlayBadge}>
					<Ionicons color={colors.light.surface} name="play" size={24} />
				</View>
			) : null}
		</View>
	);
}

function MediaTile({
	index,
	item,
	onMediaPress,
	onOpenGallery,
	onOpenImage,
	onOpenVideo,
	onRemove,
	variant,
}: {
	index: number;
	item: DiaryMediaPreviewItem;
	onMediaPress?: (item: DiaryMediaPreviewItem) => void;
	onOpenGallery: (index: number) => void;
	onOpenImage: (uri: string) => void;
	onOpenVideo: (uri: string) => void;
	onRemove?: (objectKey: string) => void;
	variant: NonNullable<DiaryMediaPreviewProps["variant"]>;
}) {
	const imageUri = getMediaPreviewUri(item);
	const ratio = useImageRatio(imageUri);
	const ratioBucket = getImageRatioBucket(ratio);
	const tileStyle = useMemo(
		() => [
			variant === "detail" ? styles.detailMediaTile : styles.mediaCard,
			getVariantStyle(variant),
			variant === "detail"
				? getDetailRatioStyle(ratio)
				: getRatioStyle(variant, ratioBucket),
		],
		[ratio, ratioBucket, variant],
	);

	return (
		<Pressable
			onPress={() => {
				if ((variant === "card" || variant === "singleCard") && onMediaPress) {
					onMediaPress(item);
					return;
				}

				if (variant === "detail" || variant === "form") {
					if (variant === "detail") {
						onOpenGallery(index);
						return;
					}

					if (isVideo(item.fileType) && item.mediaUrl) {
						onOpenVideo(item.mediaUrl);
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
				<Image
					source={{ uri: imageUri }}
					style={[
						styles.previewImage,
						variant === "detail" && styles.detailPreviewImage,
					]}
				/>
			) : (
				<Ionicons
					color={colors.light.textSecondary}
					name={isVideo(item.fileType) ? "play-circle-outline" : "image-outline"}
					size={28}
				/>
			)}
			{isVideo(item.fileType) ? (
				<View
					style={[
						styles.videoBadgeAnchor,
						variant === "detail" && styles.detailVideoBadgeAnchor,
					]}
				>
					<View style={styles.videoBadge}>
						<Ionicons color={colors.light.surface} name="play" size={12} />
						<Text style={styles.videoBadgeText}>Video</Text>
					</View>
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

function FullscreenMediaGallery({
	index,
	media,
	onClose,
	onIndexChange,
}: {
	index: number;
	media: DiaryMediaPreviewItem[];
	onClose: () => void;
	onIndexChange: (index: number) => void;
}) {
	const item = media[index];
	const canGoPrevious = index > 0;
	const canGoNext = index < media.length - 1;
	const scrollViewRef = useRef<ScrollView | null>(null);
	const { width } = useWindowDimensions();

	useEffect(() => {
		requestAnimationFrame(() => {
			scrollViewRef.current?.scrollTo({
				animated: false,
				x: index * width,
			});
		});
	}, [index, width]);

	const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);

		if (nextIndex !== index && nextIndex >= 0 && nextIndex < media.length) {
			onIndexChange(nextIndex);
		}
	};

	if (!item) {
		return null;
	}

	return (
		<Modal animationType="fade" onRequestClose={onClose} transparent visible>
			<View style={styles.galleryBackdrop}>
				<ScrollView
					horizontal
					onMomentumScrollEnd={handleMomentumScrollEnd}
					pagingEnabled
					ref={scrollViewRef}
					scrollEventThrottle={16}
					showsHorizontalScrollIndicator={false}
					style={styles.galleryPager}
				>
					{media.map((galleryItem, galleryIndex) => (
						<View
							key={galleryItem.id ?? galleryItem.objectKey}
							style={[styles.galleryPage, { width }]}
						>
							<FullscreenMediaContent
								isActive={galleryIndex === index}
								item={galleryItem}
							/>
						</View>
					))}
				</ScrollView>
				<Pressable
					accessibilityLabel="Close media viewer"
					accessibilityRole="button"
					onPress={onClose}
					style={styles.videoCloseButton}
				>
					<Ionicons color={colors.light.surface} name="close" size={22} />
				</Pressable>

				{canGoPrevious ? (
					<Pressable
						accessibilityLabel="Previous media"
						accessibilityRole="button"
						onPress={() => onIndexChange(index - 1)}
						style={[styles.galleryNavButton, styles.galleryPreviousButton]}
					>
						<Ionicons color={colors.light.surface} name="chevron-back" size={34} />
					</Pressable>
				) : null}

				{canGoNext ? (
					<Pressable
						accessibilityLabel="Next media"
						accessibilityRole="button"
						onPress={() => onIndexChange(index + 1)}
						style={[styles.galleryNavButton, styles.galleryNextButton]}
					>
						<Ionicons color={colors.light.surface} name="chevron-forward" size={34} />
					</Pressable>
				) : null}
			</View>
		</Modal>
	);
}

function FullscreenMediaContent({
	isActive,
	item,
}: {
	isActive: boolean;
	item: DiaryMediaPreviewItem;
}) {
	if (isVideo(item.fileType) && item.mediaUrl) {
		return <FullscreenVideo isActive={isActive} key={item.objectKey} uri={item.mediaUrl} />;
	}

	const imageUri = item.mediaUrl ?? item.localUri ?? item.thumbnailUrl ?? item.thumbnailLocalUri;

	return imageUri ? (
		<Image source={{ uri: imageUri }} style={styles.fullImage} />
	) : (
		<Ionicons color={colors.light.surface} name="image-outline" size={42} />
	);
}

function getMediaPreviewUri(item: DiaryMediaPreviewItem) {
	if (isVideo(item.fileType)) {
		return item.thumbnailUrl ?? item.thumbnailLocalUri ?? null;
	}

	return item.mediaUrl ?? item.localUri ?? null;
}

function FullscreenVideo({ isActive, uri }: { isActive: boolean; uri: string }) {
	const player = useVideoPlayer(uri, (playerInstance) => {
		playerInstance.loop = false;
	});

	useEffect(() => {
		if (isActive) {
			player.play();
		} else {
			player.pause();
		}
	}, [isActive, player]);

	return (
		<VideoView
			contentFit="contain"
			fullscreenOptions={{ enable: true }}
			nativeControls
			player={player}
			style={styles.fullVideo}
		/>
	);
}

function VideoModal({ onClose, uri }: { onClose: () => void; uri: string }) {
	const player = useVideoPlayer(uri, (playerInstance) => {
		playerInstance.loop = false;
	});

	useEffect(() => {
		player.play();
	}, [player]);

	return (
		<Modal animationType="fade" onRequestClose={onClose} transparent visible>
			<View style={styles.videoModalBackdrop}>
				<Pressable
					accessibilityLabel="Close video"
					accessibilityRole="button"
					onPress={onClose}
					style={styles.videoCloseButton}
				>
					<Ionicons color={colors.light.surface} name="close" size={22} />
				</Pressable>
				<VideoView
					contentFit="contain"
					fullscreenOptions={{ enable: true }}
					nativeControls
					player={player}
					style={styles.fullVideo}
				/>
			</View>
		</Modal>
	);
}

const DETAIL_MEDIA_HEIGHT = 164;
const DETAIL_MIN_MEDIA_WIDTH = 110;
const DETAIL_MAX_MEDIA_WIDTH = 280;

function getDetailRatioStyle(ratio: number | null) {
	const normalizedRatio = ratio && Number.isFinite(ratio) ? ratio : 1;

	return {
		height: DETAIL_MEDIA_HEIGHT,
		width: Math.min(
			DETAIL_MAX_MEDIA_WIDTH,
			Math.max(DETAIL_MIN_MEDIA_WIDTH, Math.round(DETAIL_MEDIA_HEIGHT * normalizedRatio)),
		),
	};
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

function useCardVisibleMediaLimit(
	media: DiaryMediaPreviewItem[],
	variant: NonNullable<DiaryMediaPreviewProps["variant"]>,
) {
	const firstThreeMedia = useMemo(() => media.slice(0, 3), [media]);
	const firstThreeKey = useMemo(
		() => firstThreeMedia.map((item) => item.id ?? item.objectKey).join("|"),
		[firstThreeMedia],
	);
	const [firstThreeRatios, setFirstThreeRatios] = useState<Record<string, number | null>>({});

	useEffect(() => {
		if (variant !== "card" || firstThreeMedia.length < 3) {
			setFirstThreeRatios({});
			return;
		}

		let isMounted = true;
		const nextRatios: Record<string, number | null> = {};

		firstThreeMedia.forEach((item) => {
			const key = item.id ?? item.objectKey;
			const uri = getMediaPreviewUri(item);

			if (!uri) {
				nextRatios[key] = null;
				if (Object.keys(nextRatios).length === firstThreeMedia.length && isMounted) {
					setFirstThreeRatios({ ...nextRatios });
				}
				return;
			}

			Image.getSize(
				uri,
				(width, height) => {
					nextRatios[key] = width > 0 && height > 0 ? width / height : null;
					if (Object.keys(nextRatios).length === firstThreeMedia.length && isMounted) {
						setFirstThreeRatios({ ...nextRatios });
					}
				},
				() => {
					nextRatios[key] = null;
					if (Object.keys(nextRatios).length === firstThreeMedia.length && isMounted) {
						setFirstThreeRatios({ ...nextRatios });
					}
				},
			);
		});

		return () => {
			isMounted = false;
		};
	}, [firstThreeKey, firstThreeMedia, variant]);

	if (variant !== "card") {
		return null;
	}

	if (media.length < 3) {
		return 2;
	}

	const allFirstThreePortrait = firstThreeMedia.every((item) => {
		const ratio = firstThreeRatios[item.id ?? item.objectKey];
		return typeof ratio === "number" && ratio < 1;
	});

	return allFirstThreePortrait ? 3 : 2;
}

function isVideo(fileType: string) {
	return fileType.toLowerCase().startsWith("video/");
}

function getImageRatioBucket(ratio: number | null): ImageRatioBucket {
	if (!ratio) {
		return "square";
	}

	if (ratio > 1.25) {
		return "horizontal";
	}

	if (ratio < 0.8) {
		return "vertical";
	}

	return "square";
}

function useImageRatio(uri: string | null): number | null {
	const [ratio, setRatio] = useState<number | null>(null);

	useEffect(() => {
		if (!uri) {
			setRatio(null);
			return;
		}

		let isMounted = true;

		Image.getSize(
			uri,
			(width, height) => {
				if (!isMounted || width <= 0 || height <= 0) {
					return;
				}

				setRatio(width / height);
			},
			() => {
				if (isMounted) {
					setRatio(null);
				}
			},
		);

		return () => {
			isMounted = false;
		};
	}, [uri]);

	return ratio;
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
		aspectRatio: 4 / 3,
		width: "48%",
	},
	detailContainer: {
		alignItems: "flex-start",
		gap: spacing.md,
		justifyContent: "space-between",
		marginTop: 0,
	},
	detailMediaTile: {
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	detailPreviewImage: {
		borderRadius: 10,
		resizeMode: "contain",
	},
	detailScrollContainer: {
		gap: spacing.md,
		marginTop: 0,
		paddingRight: spacing.md,
	},
	detailSquareMedia: {
		aspectRatio: 1,
		width: "48%",
	},
	detailVerticalMedia: {
		aspectRatio: 3 / 4,
		width: "48%",
	},
	detailVideoBadgeAnchor: {
		alignItems: "center",
		bottom: spacing.sm,
		left: 0,
		right: 0,
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
	fullVideo: {
		height: "78%",
		width: "100%",
	},
	galleryBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.94)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
	},
	galleryNavButton: {
		alignItems: "center",
		backgroundColor: "rgba(255, 255, 255, 0.14)",
		borderRadius: 999,
		height: 64,
		justifyContent: "center",
		position: "absolute",
		top: "48%",
		width: 48,
	},
	galleryNextButton: {
		right: spacing.md,
	},
	galleryPage: {
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.lg,
	},
	galleryPager: {
		...StyleSheet.absoluteFillObject,
	},
	galleryPreviousButton: {
		left: spacing.md,
	},
	heroCountBadge: {
		backgroundColor: "rgba(21, 24, 39, 0.72)",
		borderRadius: 999,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		position: "absolute",
		right: spacing.md,
		top: spacing.md,
	},
	heroCountText: {
		...typography.caption,
		color: colors.light.surface,
		fontWeight: "700",
	},
	heroDot: {
		backgroundColor: colors.light.border,
		borderRadius: 999,
		height: 7,
		width: 7,
	},
	heroDotActive: {
		backgroundColor: colors.light.primary,
		width: 18,
	},
	heroDots: {
		alignItems: "center",
		flexDirection: "row",
		gap: spacing.xs,
		justifyContent: "center",
		marginTop: spacing.sm,
	},
	heroImage: {
		height: "100%",
		resizeMode: "cover",
		width: "100%",
	},
	heroMedia: {
		alignItems: "center",
		backgroundColor: "#F7F8FC",
		borderColor: colors.light.border,
		borderRadius: 24,
		borderWidth: 1,
		height: 300,
		justifyContent: "center",
		overflow: "hidden",
		width: "100%",
	},
	heroPage: {
		paddingHorizontal: 0,
		position: "relative",
	},
	heroPager: {
		borderRadius: 24,
	},
	heroPlayBadge: {
		alignItems: "center",
		backgroundColor: "rgba(21, 24, 39, 0.72)",
		borderRadius: 999,
		bottom: spacing.lg,
		height: 58,
		justifyContent: "center",
		left: spacing.lg,
		position: "absolute",
		width: 58,
	},
	heroWrap: {
		marginTop: spacing.md,
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
	videoCloseButton: {
		alignItems: "center",
		backgroundColor: "rgba(255, 255, 255, 0.18)",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		position: "absolute",
		right: spacing.lg,
		top: spacing.xl,
		width: 44,
		zIndex: 1,
	},
	videoModalBackdrop: {
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.94)",
		flex: 1,
		justifyContent: "center",
		padding: spacing.lg,
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
		flexDirection: "row",
		gap: 2,
		paddingHorizontal: spacing.sm,
		paddingVertical: 3,
	},
	videoBadgeAnchor: {
		bottom: spacing.xs,
		position: "absolute",
		right: spacing.xs,
	},
	videoBadgeText: {
		...typography.caption,
		color: colors.light.surface,
		fontSize: 10,
	},
});
