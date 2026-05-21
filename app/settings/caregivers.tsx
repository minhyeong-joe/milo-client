import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsHeader } from "@/components/settings/SettingsRows";
import { useAppTheme } from "@/context/AppPreferencesContext";
import { useAuthSession } from "@/context/AuthSessionContext";
import { useBabySelection } from "@/context/BabySelectionContext";
import {
	acceptBabyInvite,
	createBabyInvite,
	declineBabyInvite,
	leaveBaby,
	listBabyMembers,
	listMyInvites,
	normalizeInviteCode,
	removeBabyMember,
	type BabyInvite,
	type BabyMember,
	type BabyRole,
} from "@/services/api/babies";
import { spacing, typography, type ThemeColors } from "@/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEFAULT_INVITE_ROLE: BabyRole = "CAREGIVER";

function useThemeStyles() {
	const { globalStyles, themeColors } = useAppTheme();
	const styles = useMemo(() => createStyles(themeColors), [themeColors]);

	return { globalStyles, styles, themeColors };
}

export default function ManageCaregiversScreen() {
	const router = useRouter();
	const { globalStyles, themeColors, styles } = useThemeStyles();
	const { session } = useAuthSession();
	const { refreshBabies, selectBaby, selectedBaby } = useBabySelection();
	const [members, setMembers] = useState<BabyMember[]>([]);
	const [invites, setInvites] = useState<BabyInvite[]>([]);
	const [inviteRoles, setInviteRoles] = useState<Record<string, BabyRole>>({});
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSendingInvite, setIsSendingInvite] = useState(false);
	const [actionInviteId, setActionInviteId] = useState<string | null>(null);
	const [actionMemberId, setActionMemberId] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const isOwner = selectedBaby?.isOwner === true;

	const loadSharingData = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const [membersResponse, invitesResponse] = await Promise.all([
				selectedBaby
					? listBabyMembers(selectedBaby.id)
					: Promise.resolve({ members: [] }),
				listMyInvites(),
			]);

			setMembers(membersResponse.members);
			setInvites(invitesResponse.invites);
			setInviteRoles((currentRoles) => {
				const nextRoles = { ...currentRoles };

				for (const invite of invitesResponse.invites) {
					nextRoles[invite.id] = nextRoles[invite.id] ?? DEFAULT_INVITE_ROLE;
				}

				return nextRoles;
			});
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setIsLoading(false);
		}
	}, [selectedBaby]);

	useEffect(() => {
		void loadSharingData();
	}, [loadSharingData]);

	const handleSendInvite = async () => {
		if (!selectedBaby || !isOwner) {
			return;
		}

		const trimmedEmail = email.trim().toLowerCase();

		if (!trimmedEmail) {
			setError("Enter an email address.");
			return;
		}

		setIsSendingInvite(true);
		setError(null);
		setMessage(null);

		try {
			const response = await createBabyInvite(selectedBaby.id, {
				email: trimmedEmail,
			});
			setEmail("");
			setMessage(getInviteDeliveryMessage(response.emailDelivery));
			await loadSharingData();
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setIsSendingInvite(false);
		}
	};

	const handleAcceptInvite = async (invite: BabyInvite) => {
		const role = inviteRoles[invite.id] ?? DEFAULT_INVITE_ROLE;
		setActionInviteId(invite.id);
		setError(null);
		setMessage(null);

		try {
			const response = await acceptBabyInvite({
				inviteCode: normalizeInviteCode(invite.inviteCode),
				role,
			});
			await refreshBabies();
			selectBaby(response.access.babyId);
			setMessage(`Joined ${invite.baby?.name ?? "baby"}.`);
			await loadSharingData();
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setActionInviteId(null);
		}
	};

	const handleDeclineInvite = async (invite: BabyInvite) => {
		setActionInviteId(invite.id);
		setError(null);
		setMessage(null);

		try {
			await declineBabyInvite({
				inviteCode: normalizeInviteCode(invite.inviteCode),
			});
			setMessage(`Declined invite for ${invite.baby?.name ?? "baby"}.`);
			await loadSharingData();
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setActionInviteId(null);
		}
	};

	const handleRemoveMember = (member: BabyMember) => {
		if (!selectedBaby || !isOwner || member.isOwner) {
			return;
		}

		const name =
			member.user?.displayName || member.user?.email || "this caregiver";

		Alert.alert(
			"Remove caregiver?",
			`${name} will lose access to ${selectedBaby.name}.`,
			[
				{ style: "cancel", text: "Cancel" },
				{
					onPress: () => void removeMember(member),
					style: "destructive",
					text: "Remove",
				},
			],
		);
	};

	const removeMember = async (member: BabyMember) => {
		if (!selectedBaby) {
			return;
		}

		setActionMemberId(member.id);
		setError(null);
		setMessage(null);

		try {
			await removeBabyMember(selectedBaby.id, member.userId);
			await Promise.all([refreshBabies(), loadSharingData()]);
			setMessage("Caregiver access removed.");
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setActionMemberId(null);
		}
	};

	const handleLeaveBaby = () => {
		if (!selectedBaby || isOwner) {
			return;
		}

		Alert.alert(
			"Leave care group?",
			`You will lose access to ${selectedBaby.name}.`,
			[
				{ style: "cancel", text: "Cancel" },
				{
					onPress: () => void leaveSelectedBaby(),
					style: "destructive",
					text: "Leave",
				},
			],
		);
	};

	const leaveSelectedBaby = async () => {
		if (!selectedBaby) {
			return;
		}

		setActionMemberId("me");
		setError(null);
		setMessage(null);

		try {
			await leaveBaby(selectedBaby.id);
			await refreshBabies();
			router.replace("/settings");
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setActionMemberId(null);
		}
	};

	return (
		<SafeAreaView style={globalStyles.screen}>
			<SettingsHeader onBack={() => router.back()} title="Manage Caregivers" />
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{selectedBaby ? (
					<View style={globalStyles.card}>
						<View style={styles.sectionHeader}>
							<View>
								<Text style={styles.sectionTitle}>
									{`${selectedBaby.name}'s Family Profile`}
								</Text>
							</View>
							{isLoading ? (
								<ActivityIndicator color={themeColors.primary} />
							) : null}
						</View>

						<View style={styles.memberList}>
							{members.map((member) => (
								<MemberRow
									canRemove={isOwner && !member.isOwner}
									isBusy={actionMemberId === member.id}
									key={member.id}
									member={member}
									onRemove={handleRemoveMember}
									sessionUserId={session?.user.id}
								/>
							))}
							{!isLoading && members.length === 0 ? (
								<Text style={styles.emptyText}>No members loaded yet.</Text>
							) : null}
						</View>
					</View>
				) : (
					<View style={globalStyles.card}>
						<Text style={styles.sectionTitle}>No baby selected</Text>
						<Text style={styles.sectionSubtitle}>
							Choose a baby to view caregivers.
						</Text>
					</View>
				)}

				{selectedBaby && isOwner ? (
					<View style={globalStyles.card}>
						<Text style={styles.sectionTitle}>Send invitation</Text>
						<TextInput
							autoCapitalize="none"
							autoCorrect={false}
							inputMode="email"
							keyboardType="email-address"
							onChangeText={(value) => {
								setEmail(value);
								setError(null);
								setMessage(null);
							}}
							placeholder="caregiver@example.com"
							placeholderTextColor={themeColors.textSecondary}
							style={styles.input}
							value={email}
						/>
						<Pressable
							disabled={isSendingInvite}
							onPress={handleSendInvite}
							style={({ pressed }) => [
								styles.primaryButton,
								isSendingInvite && styles.disabled,
								pressed && !isSendingInvite && styles.pressed,
							]}
						>
							<Ionicons
								color={themeColors.surface}
								name="mail-outline"
								size={18}
							/>
							<Text style={styles.primaryButtonText}>
								{isSendingInvite ? "Sending..." : "Send invitation"}
							</Text>
						</Pressable>
					</View>
				) : null}

				{selectedBaby && !isOwner ? (
					<Pressable
						disabled={actionMemberId === "me"}
						onPress={handleLeaveBaby}
						style={({ pressed }) => [
							styles.dangerButton,
							actionMemberId === "me" && styles.disabled,
							pressed && actionMemberId !== "me" && styles.pressed,
						]}
					>
						<Text style={styles.dangerButtonText}>
							{actionMemberId === "me" ? "Leaving..." : "Leave Family Profile"}
						</Text>
					</Pressable>
				) : null}

				<View style={globalStyles.card}>
					<Text style={styles.sectionTitle}>Your pending invitations</Text>
					{invites.length === 0 ? (
						<Text style={styles.emptyText}>No pending invitations.</Text>
					) : (
						<View style={styles.inviteList}>
							{invites.map((invite) => (
								<InviteCard
									actionInviteId={actionInviteId}
									invite={invite}
									key={invite.id}
									onAccept={handleAcceptInvite}
									onDecline={handleDeclineInvite}
									onRoleChange={(role) =>
										setInviteRoles((currentRoles) => ({
											...currentRoles,
											[invite.id]: role,
										}))
									}
									role={inviteRoles[invite.id] ?? DEFAULT_INVITE_ROLE}
								/>
							))}
						</View>
					)}
				</View>

				{message ? <Text style={styles.successText}>{message}</Text> : null}
				{error ? <Text style={styles.errorText}>{error}</Text> : null}
			</ScrollView>
		</SafeAreaView>
	);
}

function MemberRow({
	canRemove,
	isBusy,
	member,
	onRemove,
	sessionUserId,
}: {
	canRemove: boolean;
	isBusy: boolean;
	member: BabyMember;
	onRemove: (member: BabyMember) => void;
	sessionUserId?: string;
}) {
	const { styles } = useThemeStyles();
	const name = member.user?.displayName || member.user?.email || "Caregiver";

	return (
		<View style={styles.memberRow}>
			<View style={styles.initialCircle}>
				<Text style={styles.initialText}>{getInitial(name)}</Text>
			</View>
			<View style={styles.userText}>
				<View style={styles.nameLine}>
					{member.userId === sessionUserId ? (
						<Text style={styles.userName}>You ({formatRole(member.role)})</Text>
					) : (
						<Text style={styles.userName}>
							{name} ({formatRole(member.role)})
						</Text>
					)}
					{member.isOwner ? <Text style={styles.ownerPill}>Owner</Text> : null}
				</View>
				<Text style={styles.userMeta}>{member.user?.email ?? "No email"}</Text>
			</View>
			{canRemove ? (
				<Pressable
					disabled={isBusy}
					onPress={() => onRemove(member)}
					style={({ pressed }) => [
						styles.removeButton,
						isBusy && styles.disabled,
						pressed && !isBusy && styles.pressed,
					]}
				>
					<Text style={styles.removeButtonText}>
						{isBusy ? "..." : "Remove"}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function InviteCard({
	actionInviteId,
	invite,
	onAccept,
	onDecline,
	onRoleChange,
	role,
}: {
	actionInviteId: string | null;
	invite: BabyInvite;
	onAccept: (invite: BabyInvite) => void;
	onDecline: (invite: BabyInvite) => void;
	onRoleChange: (role: BabyRole) => void;
	role: BabyRole;
}) {
	const { themeColors, styles } = useThemeStyles();
	const isBusy = actionInviteId === invite.id;

	return (
		<View style={styles.inviteCard}>
			<View style={styles.inviteHeader}>
				<View>
					<Text style={styles.inviteTitle}>
						{invite.baby?.name ?? "Baby invite"}
					</Text>
					<Text style={styles.userMeta}>
						From{" "}
						{invite.invitedBy?.displayName || invite.invitedBy?.email || "Milo"}
					</Text>
				</View>
				<Text style={styles.codePill}>{invite.inviteCode}</Text>
			</View>
			<Text style={styles.expiryText}>
				Expires {formatDateTime(invite.expiresAt)}
			</Text>
			<RoleSelector role={role} onChange={onRoleChange} />
			<View style={styles.actionRow}>
				<Pressable
					disabled={isBusy}
					onPress={() => onDecline(invite)}
					style={({ pressed }) => [
						styles.secondaryButton,
						isBusy && styles.disabled,
						pressed && !isBusy && styles.pressed,
					]}
				>
					<Text style={styles.secondaryButtonText}>Decline</Text>
				</Pressable>
				<Pressable
					disabled={isBusy}
					onPress={() => onAccept(invite)}
					style={({ pressed }) => [
						styles.acceptButton,
						isBusy && styles.disabled,
						pressed && !isBusy && styles.pressed,
					]}
				>
					<Ionicons color={themeColors.surface} name="checkmark" size={18} />
					<Text style={styles.acceptButtonText}>
						{isBusy ? "Working..." : "Accept"}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function RoleSelector({
	onChange,
	role,
}: {
	onChange: (role: BabyRole) => void;
	role: BabyRole;
}) {
	const { styles } = useThemeStyles();
	return (
		<View style={styles.roleRow}>
			<RoleButton
				active={role === "FATHER"}
				label="Father"
				onPress={() => onChange("FATHER")}
			/>
			<RoleButton
				active={role === "MOTHER"}
				label="Mother"
				onPress={() => onChange("MOTHER")}
			/>
			<RoleButton
				active={role === "CAREGIVER"}
				label="Caregiver"
				onPress={() => onChange("CAREGIVER")}
			/>
		</View>
	);
}

function RoleButton({
	active,
	label,
	onPress,
}: {
	active: boolean;
	label: string;
	onPress: () => void;
}) {
	const { styles } = useThemeStyles();

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				styles.roleButton,
				active && styles.roleButtonActive,
				pressed && styles.pressed,
			]}
		>
			<Text style={[styles.roleText, active && styles.roleTextActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

function getInitial(value?: string | null) {
	return value?.trim().charAt(0).toUpperCase() || "?";
}

function formatRole(role?: string) {
	if (!role) {
		return "Role unavailable";
	}

	return role.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong. Please try again.";
}

function getInviteDeliveryMessage(
	delivery: Awaited<ReturnType<typeof createBabyInvite>>["emailDelivery"],
) {
	if (!delivery) {
		return "Invitation created.";
	}

	if (delivery.status === "sent") {
		return "Invitation sent.";
	}

	if (delivery.status === "skipped") {
		return `Invitation created. Email skipped: ${delivery.reason}`;
	}

	return `Invitation created. Email failed: ${delivery.error}`;
}

function createStyles(themeColors: ThemeColors) {
	return StyleSheet.create({
		acceptButton: {
			alignItems: "center",
			backgroundColor: themeColors.primary,
			borderRadius: 12,
			flex: 1,
			flexDirection: "row",
			gap: spacing.xs,
			justifyContent: "center",
			minHeight: 44,
		},
		acceptButtonText: {
			...typography.label,
			color: themeColors.surface,
		},
		actionRow: {
			flexDirection: "row",
			gap: spacing.sm,
		},
		codePill: {
			...typography.caption,
			backgroundColor: "#F1ECFF",
			borderRadius: 10,
			color: themeColors.primary,
			fontWeight: "800",
			overflow: "hidden",
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.xs,
		},
		content: {
			gap: spacing.md,
			padding: spacing.md,
			paddingBottom: spacing.xl,
		},
		disabled: {
			opacity: 0.5,
		},
		dangerButton: {
			alignItems: "center",
			borderColor: themeColors.error,
			borderRadius: 12,
			borderWidth: 1,
			justifyContent: "center",
			minHeight: 46,
		},
		dangerButtonText: {
			...typography.label,
			color: themeColors.error,
		},
		emptyText: {
			...typography.body,
			color: themeColors.textSecondary,
			marginTop: spacing.sm,
		},
		errorText: {
			...typography.body,
			color: themeColors.error,
			textAlign: "center",
		},
		expiryText: {
			...typography.caption,
			color: themeColors.textSecondary,
		},
		initialCircle: {
			alignItems: "center",
			backgroundColor: "#F1ECFF",
			borderRadius: 24,
			height: 48,
			justifyContent: "center",
			width: 48,
		},
		initialText: {
			...typography.label,
			color: themeColors.primary,
		},
		input: {
			...typography.body,
			backgroundColor: themeColors.background,
			borderColor: themeColors.border,
			borderRadius: 12,
			borderWidth: 1,
			color: themeColors.textPrimary,
			marginTop: spacing.md,
			minHeight: 50,
			paddingHorizontal: spacing.md,
		},
		inviteCard: {
			borderColor: themeColors.border,
			borderRadius: 12,
			borderWidth: 1,
			gap: spacing.md,
			padding: spacing.md,
		},
		inviteHeader: {
			alignItems: "flex-start",
			flexDirection: "row",
			gap: spacing.sm,
			justifyContent: "space-between",
		},
		inviteList: {
			gap: spacing.md,
			marginTop: spacing.md,
		},
		inviteTitle: {
			...typography.label,
			color: themeColors.textPrimary,
		},
		memberList: {
			gap: spacing.md,
			marginTop: spacing.md,
		},
		memberRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: spacing.md,
		},
		nameLine: {
			alignItems: "center",
			flexDirection: "row",
			flexWrap: "wrap",
			gap: spacing.xs,
		},
		ownerPill: {
			...typography.caption,
			backgroundColor: "#EAF8EF",
			borderRadius: 8,
			color: "#2FAE62",
			fontWeight: "800",
			overflow: "hidden",
			paddingHorizontal: spacing.xs,
			paddingVertical: 2,
		},
		pressed: {
			opacity: 0.72,
		},
		primaryButton: {
			alignItems: "center",
			backgroundColor: themeColors.primary,
			borderRadius: 12,
			flexDirection: "row",
			gap: spacing.xs,
			justifyContent: "center",
			marginTop: spacing.md,
			minHeight: 48,
		},
		primaryButtonText: {
			...typography.label,
			color: themeColors.surface,
		},
		roleButton: {
			alignItems: "center",
			borderRadius: 10,
			flex: 1,
			justifyContent: "center",
			minHeight: 40,
		},
		roleButtonActive: {
			backgroundColor: themeColors.surface,
		},
		roleRow: {
			backgroundColor: themeColors.background,
			borderRadius: 12,
			flexDirection: "row",
			gap: spacing.xs,
			padding: spacing.xs,
		},
		roleText: {
			...typography.caption,
			color: themeColors.textSecondary,
			textAlign: "center",
		},
		roleTextActive: {
			color: themeColors.primary,
		},
		removeButton: {
			alignItems: "center",
			borderColor: themeColors.error,
			borderRadius: 10,
			borderWidth: 1,
			justifyContent: "center",
			minHeight: 36,
			paddingHorizontal: spacing.sm,
		},
		removeButtonText: {
			...typography.caption,
			color: themeColors.error,
			fontWeight: "800",
		},
		secondaryButton: {
			alignItems: "center",
			borderColor: themeColors.border,
			borderRadius: 12,
			borderWidth: 1,
			flex: 1,
			justifyContent: "center",
			minHeight: 44,
		},
		secondaryButtonText: {
			...typography.label,
			color: themeColors.textPrimary,
		},
		sectionHeader: {
			alignItems: "flex-start",
			flexDirection: "row",
			gap: spacing.md,
			justifyContent: "space-between",
		},
		sectionSubtitle: {
			...typography.body,
			color: themeColors.textSecondary,
			marginTop: 3,
		},
		sectionTitle: {
			...typography.sectionTitle,
			color: themeColors.textPrimary,
		},
		successText: {
			...typography.body,
			color: "#2FAE62",
			textAlign: "center",
		},
		userMeta: {
			...typography.caption,
			color: themeColors.textSecondary,
			marginTop: 2,
		},
		userName: {
			...typography.label,
			color: themeColors.textPrimary,
		},
		userText: {
			flex: 1,
		},
	});
}
