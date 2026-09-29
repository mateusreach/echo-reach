import { describe, expect, test } from "bun:test";
import { missingBridgeObject } from "./workspace-bridge.ts";

describe("Workspace bridge compatibility", () => {
  test("detects an unapplied table migration", () => {
    expect(missingBridgeObject({ code: "PGRST205", message: "Could not find the table 'public.workspace_task_sources' in the schema cache" }, "workspace_task_sources")).toBe(true);
  });

  test("detects an unapplied RPC migration", () => {
    expect(missingBridgeObject({ code: "PGRST202", message: "Could not find the function public.dispatch_brand_item_to_workspace in the schema cache" }, "dispatch_brand_item_to_workspace")).toBe(true);
  });

  test("does not hide permission failures", () => {
    expect(missingBridgeObject({ code: "42501", message: "permission denied for table workspace_task_sources" }, "workspace_task_sources")).toBe(false);
  });
});
