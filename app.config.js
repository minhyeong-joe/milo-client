const VARIANT = process.env.APP_VARIANT;

const variantConfig = {
	development: {
		name: "milo (Dev)",
		identifier: "com.mjoe.milo.dev",
		scheme: "milo-dev",
	},
	preview: {
		name: "milo (Preview)",
		identifier: "com.mjoe.milo.preview",
		scheme: "milo-preview",
	},
	production: {
		name: "milo",
		identifier: "com.mjoe.milo",
		scheme: "milo",
	},
};

const getVariantConfig = () => {
	if (VARIANT === "development") {
		return variantConfig.development;
	}

	if (VARIANT === "preview") {
		return variantConfig.preview;
	}

	return variantConfig.production;
};

module.exports = ({ config }) => {
	const appVariant = getVariantConfig();
	const plugins = config.plugins ?? [];

	return {
		...config,
		name: appVariant.name,
		scheme: appVariant.scheme,
		ios: {
			...config.ios,
			bundleIdentifier: appVariant.identifier,
		},
		android: {
			...config.android,
			package: appVariant.identifier,
			softwareKeyboardLayoutMode: "resize",
		},
		plugins: [
			...plugins,
			"expo-secure-store",
			[
				"expo-dev-client",
				{
					addGeneratedScheme: VARIANT === "development",
				},
			],
			"expo-sqlite",
		],
	};
};
