import { createFileRoute, redirect } from "@tanstack/react-router";

// "Meu acesso" agora vive fora do Workspace, para equipe e cliente: /meu-acesso.
export const Route = createFileRoute("/workspace/meu-acesso")({
  beforeLoad: () => {
    throw redirect({ to: "/meu-acesso" });
  },
});
