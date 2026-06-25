import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Tiny offline indicator. Doesn't replace the app — the service worker
// keeps the shell rendering — it just lets the user know why writes are
// queued.

export function OfflineShell() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    function on() {
      setOnline(true);
    }
    function off() {
      setOnline(false);
    }
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-sm"
    >
      <WifiOff size={12} strokeWidth={1.8} />
      Offline — viewing cached
    </div>
  );
}
