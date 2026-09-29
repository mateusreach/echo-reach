import { describe, expect, test } from "bun:test";
import { mergeWorkspaceSnapshots, parseWorkspaceSnapshot } from "./workspace-legacy-data.ts";

describe("Workspace ZIP data", () => {
  test("normalizes incomplete but valid clients", () => {
    const state = parseWorkspaceSnapshot({
      clients: [{ id: "1", name: "Cliente", fronts: [{ id: "2", name: "Feed" }] }],
    });
    expect(state.clients[0].team).toEqual([]);
    expect(state.clients[0].fronts[0].tasks).toEqual([]);
  });

  test("merges imported fronts and tasks without duplicating a Brand client", () => {
    const current = parseWorkspaceSnapshot({
      clients: [
        {
          id: "brand-id",
          name: "Aurora",
          fronts: [{ id: "front-id", name: "Feed", tasks: [{ id: "task-id", title: "Post" }] }],
        },
      ],
    });
    const imported = parseWorkspaceSnapshot({
      clients: [
        {
          id: "zip-id",
          name: "Aurora",
          fronts: [
            {
              id: "zip-front",
              name: "Feed",
              tasks: [
                { id: "zip-task", title: "Post", status: "Iniciada" },
                { id: "new-task", title: "Vídeo" },
              ],
            },
          ],
        },
      ],
    });
    const merged = mergeWorkspaceSnapshots(current, imported);
    const client = merged.clients[0];
    const front = client.fronts[0];
    const tasks = front.tasks;
    expect(merged.clients).toHaveLength(1);
    expect(client.id).toBe("brand-id");
    expect(front.id).toBe("front-id");
    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.id)).toEqual(["task-id", "zip-task", "new-task"]);
  });
});
