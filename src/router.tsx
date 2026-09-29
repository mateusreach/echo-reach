import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteTransition } from "./components/reach/route-transition";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Identidade Reach Brand durante transições entre páginas: só aparece se
    // o carregamento da rota levar mais que defaultPendingMs (evita flash em
    // navegações instantâneas).
    defaultPendingComponent: RouteTransition,
    defaultPendingMs: 250,
    defaultPendingMinMs: 300,
  });

  return router;
};
