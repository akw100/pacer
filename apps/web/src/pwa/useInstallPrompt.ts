import { useEffect, useState } from 'react';

// Capture the browser's `beforeinstallprompt` so the Install button can fire
// it on a tap (Chromium auto-install rule). Safari iOS doesn't fire this
// event — there we surface a manual "Add to Home Screen" hint instead.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptHook {
  canPrompt: boolean;
  isStandalone: boolean;
  isIos: boolean;
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useInstallPrompt(): InstallPromptHook {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setEvt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  const isIos =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return {
    canPrompt: !!evt && !installed && !isStandalone,
    isStandalone,
    isIos,
    async prompt() {
      if (!evt) return 'unavailable';
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') setEvt(null);
      return choice.outcome;
    },
  };
}
