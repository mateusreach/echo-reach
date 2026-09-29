import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/e360")({ component: () => <Outlet /> });
