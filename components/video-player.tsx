"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";

type Props = {
  assetId: string;
  title: string;
  subtitle?: string;
};

export function VideoPlayer({ assetId, title, subtitle }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStreamUrl() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/stream-ticket/${assetId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to prepare secure stream.");
        }
        const data = (await response.json()) as { streamUrl?: string };
        if (!data.streamUrl) {
          throw new Error("Missing secure stream URL.");
        }
        if (active) {
          setStreamUrl(data.streamUrl);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Stream setup failed.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadStreamUrl();
    return () => {
      active = false;
    };
  }, [assetId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || loading || error) {
      return;
    }

    let reloaded = false;
    const tamperDetected = () => {
      const controlsListValue = video.getAttribute("controlsList") ?? "";
      const hasNoDownload = controlsListValue.toLowerCase().includes("nodownload");
      if (!hasNoDownload && !reloaded) {
        reloaded = true;
        window.location.reload();
      }
    };

    const enforce = () => {
      video.setAttribute("controlsList", "nodownload noplaybackrate");
      video.disablePictureInPicture = true;
      video.oncontextmenu = (event) => event.preventDefault();
    };

    enforce();
    tamperDetected();

    const observer = new MutationObserver(() => {
      tamperDetected();
      enforce();
    });

    observer.observe(video, {
      attributes: true,
      attributeFilter: ["controlsList", "controls", "disablePictureInPicture"],
    });

    const intervalId = window.setInterval(() => {
      tamperDetected();
      enforce();
    }, 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
    };
  }, [loading, error, streamUrl]);

  return (
    <article className="overflow-hidden rounded-2xl border border-[#d8e1f5] bg-white shadow-[0_10px_24px_rgba(15,35,87,0.08)]">
      <div className="flex items-start justify-between gap-3 border-b border-[#d8e1f5] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#00194c]">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-[#6a7dab]">{subtitle}</p> : null}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2 py-1 text-[11px] font-semibold text-[#1c64f2]">
          <PlayCircle size={12} />
          Stream
        </span>
      </div>
      <div className="bg-black">
        {loading ? (
          <div className="grid aspect-video place-items-center text-sm text-white/80">Preparing secure stream...</div>
        ) : error ? (
          <div className="grid aspect-video place-items-center px-4 text-center text-sm text-red-200">{error}</div>
        ) : (
          <video
            ref={videoRef}
            className="aspect-video w-full"
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            src={streamUrl}
          />
        )}
      </div>
    </article>
  );
}
