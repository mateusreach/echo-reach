export function ReachBackground() {
  return (
    <div className="bg-canvas">
      <div className="reach-blob left-[-10%] top-[-10%] h-[520px] w-[520px] bg-reach-coral" style={{ animationDelay: "0s" }} />
      <div className="reach-blob right-[-15%] top-[10%] h-[600px] w-[600px] bg-reach-violet" style={{ animationDelay: "-8s" }} />
      <div className="reach-blob bottom-[-15%] left-[20%] h-[480px] w-[480px] bg-reach-blue" style={{ animationDelay: "-14s" }} />
    </div>
  );
}
