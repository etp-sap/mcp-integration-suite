import path from "path";
import { getRuntimeConfig } from "../envConfig";

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
