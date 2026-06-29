import { youTubeEmbedUrl } from '@pacer/shared';

// Embeds a challenge's YouTube video via the privacy-friendly nocookie host.
// Renders nothing if the stored url isn't a recognisable video (defensive —
// the API already normalises on write).

interface YouTubeEmbedProps {
  url: string | null;
  title?: string;
}

export function YouTubeEmbed({ url, title }: YouTubeEmbedProps) {
  const embed = url ? youTubeEmbedUrl(url) : null;
  if (!embed) return null;
  return (
    <div className="overflow-hidden rounded-card border border-border bg-ink/5">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embed}
          title={title ?? 'Challenge video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
