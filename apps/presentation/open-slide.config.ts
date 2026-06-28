import type { OpenSlideConfig } from '@open-slide/core';

// Served under the Pacer site at /presentation/ (the deck builds into
// apps/web/public/presentation, which Vite copies into the web dist).
// Dev runs on 5273 so it never collides with the web app on 5173.
const openSlideConfig: OpenSlideConfig = {
  base: '/presentation/',
  port: 5273,
  build: {
    // It's a pitch deck, not an editable doc for the audience — hide the
    // "download HTML" affordance in the production build.
    allowHtmlDownload: false,
  },
};

export default openSlideConfig;
