import path from "path";

export type RuntimeConfig = {
	envFilePath: string;
	envFileBaseName: string;
	serverName: string;
};

const getArgValue = (args: string[], name: string): string | undefined => {
	const index = args.indexOf(name);
	if (index === -1) return undefined;

	return args[index + 1];
};

const getEnvAlias = (args: string[], env: NodeJS.ProcessEnv): string =>
	getArgValue(args, "--env") || env.MCP_ENV_FILE || args[0] || ".env";

const sanitizeServerNamePart = (value: string): string =>
	value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export const getRuntimeConfig = (
	args: string[],
	env: NodeJS.ProcessEnv,
	projectPath: string
): RuntimeConfig => {
	const envFileName = getEnvAlias(args, env);
	const parsedEnvFileName = path.parse(envFileName);
	const envFile = envFileName === ".env" || parsedEnvFileName.ext
		? envFileName
		: `${envFileName}.env`;

	const envFilePath = path.isAbsolute(envFile)
		? envFile
		: path.join(projectPath, envFile);
	const parsedPath = path.parse(envFilePath);
	const envFileBaseName = parsedPath.name || ".env";
	const defaultServerName =
		envFile === ".env"
			? "integration-suite"
			: `integration-suite-${sanitizeServerNamePart(envFileBaseName) || "default"}`;
	const serverName =
		getArgValue(args, "--server-name") ||
		env.MCP_SERVER_NAME ||
		defaultServerName;

	return {
		envFilePath,
		envFileBaseName,
		serverName,
	};
};
