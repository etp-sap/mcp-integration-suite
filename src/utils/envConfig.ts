import path from "path";
import fs from "fs";
import { config as loadDotenv, parse as parseDotenv } from "dotenv";

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

	let envFilePath = path.isAbsolute(envFile)
		? envFile
		: path.join(projectPath, envFile);
	if (!envFilePath.toLowerCase().endsWith(".json")) {
		const jsonPath = envFilePath + ".json";
		if (fs.existsSync(jsonPath)) envFilePath = jsonPath;
	}
	const parsedPath = path.parse(envFilePath);
	const envFileBaseName = (parsedPath.name.endsWith(".env") ? parsedPath.name.slice(0, -4) : parsedPath.name) || ".env";
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

export const loadRuntimeCredentials = (filePath: string, env: NodeJS.ProcessEnv = process.env): void => {
	if (!filePath.toLowerCase().endsWith(".json")) {
		loadDotenv({ path: filePath, processEnv: env as Record<string, string> });
		return;
	}
	const key = JSON.parse(fs.readFileSync(filePath, "utf8"));
	const oauth = key.oauth || key.uaa || key;
	const endpoints = key.endpoints || {};
	const clientId = oauth.clientid || oauth.client_id;
	const clientSecret = oauth.clientsecret || oauth.client_secret;
	const tokenUrl = oauth.tokenurl || (oauth.url && `${oauth.url.replace(/\/$/, "")}/oauth/token`);
	const envPath = filePath.replace(/(?:\.env)?\.json$/i, ".env");
	const fallback = fs.existsSync(envPath) ? parseDotenv(fs.readFileSync(envPath)) : {};
	const apiUrl = endpoints.api || key.apiurl || env.API_BASE_URL || fallback.API_BASE_URL;
	if (![clientId, clientSecret, tokenUrl, apiUrl].every(value => typeof value === "string" && value.length > 0)) {
		throw new Error("Service key requires OAuth clientid, clientsecret, tokenurl (or url), and an API address in JSON, the environment, or the matching .env file.");
	}
	const values: Record<string, string> = {
		API_BASE_URL: apiUrl.replace(/\/$/, "").endsWith("/api/v1") ? apiUrl.replace(/\/$/, "") : `${apiUrl.replace(/\/$/, "")}/api/v1`,
		API_OAUTH_CLIENT_ID: clientId,
		API_OAUTH_CLIENT_SECRET: clientSecret,
		API_OAUTH_TOKEN_URL: tokenUrl,
	};
	const runtimeUrl = endpoints.https || env.CPI_BASE_URL || fallback.CPI_BASE_URL;
	if (runtimeUrl) {
		values.CPI_BASE_URL = runtimeUrl.replace(/\/$/, "");
		values.CPI_OAUTH_CLIENT_ID = clientId;
		values.CPI_OAUTH_CLIENT_SECRET = clientSecret;
		values.CPI_OAUTH_TOKEN_URL = tokenUrl;
	}
	for (const [name, value] of Object.entries(values)) {
		if (env[name] === undefined) env[name] = value;
	}
};
