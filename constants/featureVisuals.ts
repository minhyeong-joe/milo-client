import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export const FEATURE_VISUALS = {
	growth: {
		accentColor: "#2FAE62",
		backgroundColor: "#EAF8EF",
		icon: "scale-outline",
	},
	immunization: {
		accentColor: "#0EA5A4",
		backgroundColor: "#E6FFFB",
		icon: "medkit-outline",
	},
} as const satisfies Record<string, {
	accentColor: string;
	backgroundColor: string;
	icon: IoniconName;
}>;
