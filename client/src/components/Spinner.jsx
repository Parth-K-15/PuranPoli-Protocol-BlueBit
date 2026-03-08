import { Loader2 } from "lucide-react";

export default function Spinner({ className = "" }) {
  return (
    <div className={`flex items-center justify-center py-20 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  );
}
