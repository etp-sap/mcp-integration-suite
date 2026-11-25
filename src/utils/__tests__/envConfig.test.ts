import path from "path";
import fs from "fs";
import os from "os";
import { getRuntimeConfig, loadRuntimeCredentials } from "../envConfig";

describe("Runtime environment config", () => {
	const projectPath = path.join("C:", "project");

	it("uses .env by default", () => {
		const result = getRuntimeConfig([], {}, projectPath);

		expect(result.envFilePath).toBe(path.join(projectPath, ".env"));
		expect(result.envFileBaseName).toBe(".env");
		expect(result.serverName).toBe("integration-suite");
	});

	it("uses --env to select a tenant env file and derive the server name", () => {
		const result = getRuntimeConfig(["--env", "RuJing"], {}, projectPath);

		expect(result.envFilePath).toBe(path.join(projectPath, "RuJing.env"));
		expect(result.envFileBaseName).toBe("RuJing");
		expect(result.serverName).toBe("integration-suite-RuJing");
	});

	it("uses the first positional argument as the tenant env alias", () => {
		const result = getRuntimeConfig(["KLT"], {}, projectPath);

		expect(result.envFilePath).toBe(path.join(projectPath, "KLT.env"));
		expect(result.envFileBaseName).toBe("KLT");
		expect(result.serverName).toBe("integration-suite-KLT");
	});

	it("accepts an explicit .env suffix", () => {
		const result = getRuntimeConfig(["--env", "RuJing.env"], {}, projectPath);

		expect(result.envFilePath).toBe(path.join(projectPath, "RuJing.env"));
		expect(result.envFileBaseName).toBe("RuJing");
		expect(result.serverName).toBe("integration-suite-RuJing");
	});

	it("allows explicit server name override", () => {
		const result = getRuntimeConfig(
			["--env", "KLT.env", "--server-name", "integration-suite-klt-prod"],
			{},
			projectPath
		);

		expect(result.serverName).toBe("integration-suite-klt-prod");
	});

	it("uses MCP_ENV_FILE when --env is not provided", () => {
		const result = getRuntimeConfig([], { MCP_ENV_FILE: "KLT" }, projectPath);

		expect(result.envFilePath).toBe(path.join(projectPath, "KLT.env"));
		expect(result.serverName).toBe("integration-suite-KLT");
	});
});

describe("Service key loading", () => {
	let directory: string;
	beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-config-")); });
	afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

	it("prefers JSON and maps a service key to runtime credentials", () => {
		fs.writeFileSync(path.join(directory, "KLT.env"), "API_BASE_URL=https://fallback.example\n");
		fs.writeFileSync(path.join(directory, "KLT.env.json"), JSON.stringify({
			endpoints: { api: "https://api.example", https: "https://runtime.example" },
			oauth: { clientid: "id", clientsecret: "secret", tokenurl: "https://auth.example/token" },
		}));
		const selected = getRuntimeConfig(["KLT"], {}, directory);
		const env: NodeJS.ProcessEnv = {};
		loadRuntimeCredentials(selected.envFilePath, env);
		expect(selected.envFilePath).toBe(path.join(directory, "KLT.env.json"));
		expect(env.API_BASE_URL).toBe("https://api.example/api/v1");
		expect(env.CPI_BASE_URL).toBe("https://runtime.example");
		expect(env.API_OAUTH_CLIENT_ID).toBe("id");
	});

	it("falls back to env only when JSON is absent", () => {
		fs.writeFileSync(path.join(directory, "KLT.env"), "API_BASE_URL=https://fallback.example\n");
		const env: NodeJS.ProcessEnv = {};
		loadRuntimeCredentials(getRuntimeConfig(["KLT"], {}, directory).envFilePath, env);
		expect(env.API_BASE_URL).toBe("https://fallback.example");
		fs.writeFileSync(path.join(directory, "KLT.env.json"), "{}");
		expect(() => loadRuntimeCredentials(getRuntimeConfig(["KLT"], {}, directory).envFilePath, {})).toThrow("Service key requires");
	});

	it("prefers the BTP sample naming and supplements only URLs from the matching env", () => {
		fs.writeFileSync(path.join(directory, "ZB.env"), "API_BASE_URL=https://api.example/api/v1\nCPI_BASE_URL=https://runtime.example\nAPI_OAUTH_CLIENT_ID=old\n");
		fs.writeFileSync(path.join(directory, "ZB.env.json"), JSON.stringify({ oauth: { clientid: "new", clientsecret: "secret", url: "https://auth.example" } }));
		const selected = getRuntimeConfig(["ZB"], {}, directory);
		const env: NodeJS.ProcessEnv = {};
		loadRuntimeCredentials(selected.envFilePath, env);
		expect(selected.envFilePath).toBe(path.join(directory, "ZB.env.json"));
		expect(selected.serverName).toBe("integration-suite-ZB");
		expect(env.API_BASE_URL).toBe("https://api.example/api/v1");
		expect(env.API_OAUTH_CLIENT_ID).toBe("new");
		expect(env.CPI_OAUTH_CLIENT_ID).toBe("new");
		expect(env.API_OAUTH_TOKEN_URL).toBe("https://auth.example/oauth/token");
	});
});
