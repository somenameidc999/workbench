import { discoverServers } from "./registry";

const servers = await discoverServers();

if (servers.length === 0) {
  console.log("No MCP-capable servers found in packages/");
  process.exit(0);
}

console.log(`Found ${servers.length} server(s):\n`);

for (const server of servers) {
  console.log(`  ${server.name}`);
  console.log(`    package: ${server.packageName}`);
  console.log(`    cwd:     ${server.cwd}`);
  console.log(`    command: ${server.command.join(" ")}`);
  console.log(`    tags:    ${server.tags.join(", ")}`);
  console.log();
}
