import { useEffect } from "react";

export default function SmartFrame({ url, onClose }: { url: string; onClose?: () => void }) {
  useEffect(() => {
    return () => { onClose?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-4 z-50 flex flex-col rounded-xl border border-border bg-background/90 shadow-lg">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="truncate text-sm text-muted-foreground">In-App Viewer</div>
        <div className="ml-auto flex items-center gap-2">
          <button className="text-sm text-muted-foreground" onClick={() => onClose?.()}>Schließen</button>
        </div>
      </div>
      <iframe src={url} className="flex-1 w-full h-full" sandbox="allow-forms allow-scripts allow-same-origin allow-popups" />
    </div>
  );
}
