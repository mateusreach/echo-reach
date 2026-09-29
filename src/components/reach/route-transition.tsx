import { ReachIconAnimation } from "./reach-icon-animation";

/** Estado de transição entre páginas (defaultPendingComponent do router). */
export function RouteTransition() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <ReachIconAnimation size={40} context="transition" />
    </div>
  );
}
