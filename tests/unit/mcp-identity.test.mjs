// A connected assistant (Claude, over MCP) acts only for the verified member its
// token names: it reads the month, never confirms, and never reads files.
import assert from "node:assert/strict";
import test from "node:test";

import { openExample, prepareDatabase, realMember } from "../helpers/example-database.mjs";

const sql = await prepareDatabase();
const { runWithRequestContext } = await import("@agent-native/core/server");
const { ownMemberActor } = await import("../../server/lib/member-identity.ts");
const { checkMemberMonth } = await import("../../server/lib/member-month.ts");
const { doMonth } = await import("../../server/lib/month-work.ts");
const access = await import("../../shared/access.ts");
const actions = {
  check: (await import("../../actions/check_month.ts")).default,
  list: (await import("../../actions/list_evidence.ts")).default,
  work: (await import("../../actions/do_my_month.ts")).default,
  confirm: (await import("../../actions/confirm_evidence.ts")).default,
  packet: (await import("../../actions/proof_packet.ts")).default,
};

const mcp = (account, ambient, fn) =>
  runWithRequestContext(
    { userEmail: account.email, authUserId: account.userId, mcpRequestId: "mcp-1", ...ambient },
    () => fn({ caller: "mcp", userEmail: account.email }),
  );

test("the month, the lines and the month's work are MCP tools; confirming and the packet are not", () => {
  assert.equal(actions.check.mcpTool, true);
  assert.equal(actions.list.mcpTool, true);
  assert.equal(actions.work.mcpTool, true);
  assert.equal(actions.confirm.mcpTool, false);
  assert.equal(actions.packet.mcpTool, false);
});

test("a verified member's MCP call reads their own month", async () => {
  const member = await realMember("mcp.member@example.test");
  const actor = await mcp(member, {}, (context) => ownMemberActor(context));
  assert.deepEqual(actor, { email: member.email, userId: member.userId });
  const month = await mcp(member, {}, (context) => checkMemberMonth(undefined, context));
  assert.ok(month.months.length >= 1);
  const work = await mcp(member, {}, (context) => doMonth({ read: true }, context));
  assert.deepEqual(work.read, [], "an outside assistant never reads files");
});

test("without the framework's verified MCP identity, the call is refused", async () => {
  const member = await realMember("mcp.unverified-token@example.test");
  await assert.rejects(
    mcp(member, { authUserId: undefined }, (context) => ownMemberActor(context)),
  );
  // A stateless MCP connection has no request id; the verified account id is what counts.
  assert.deepEqual(
    await mcp(member, { mcpRequestId: undefined }, (context) => ownMemberActor(context)),
    { email: member.email, userId: member.userId },
  );
  await assert.rejects(
    mcp(member, { authUserId: "someone-else" }, (context) => ownMemberActor(context)),
    /Verify your email first/,
  );
});

test("an unverified email and an example account are refused", async () => {
  const member = await realMember("mcp.unverified-email@example.test");
  await sql.execute({ sql: 'UPDATE "user" SET email_verified = false WHERE email = ?', args: [member.email] });
  await assert.rejects(
    mcp(member, {}, (context) => ownMemberActor(context)),
    /Verify your email first/,
  );
  const maria = await openExample("maria", "198.51.100.120");
  await assert.rejects(mcp(maria, {}, (context) => ownMemberActor(context)));
});

test("the MCP endpoint and its OAuth steps pass the site's check", () => {
  for (const path of [
    "/_agent-native/mcp",
    "/_agent-native/mcp/oauth/register",
    "/_agent-native/mcp/oauth/authorize",
    "/_agent-native/mcp/oauth/token",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/_agent-native/mcp",
    "/.well-known/oauth-authorization-server",
    "/mcp/oauth/register",
    "/mcp/oauth/authorize",
    "/mcp/oauth/token",
    "/_agent-native/auth/login",
  ])
    assert.equal(access.isAllowedRequest(path, "POST"), true, path);
  assert.equal(access.isAllowedRequest("/_agent-native/mcp/approvals/x", "POST"), false);
  assert.equal(access.isAllowedRequest("/.well-known/openid-configuration", "GET"), false);
  assert.equal(access.isExampleAllowedRequest("/_agent-native/mcp", "POST"), false);
});
