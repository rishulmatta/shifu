"use client";

// Plays one span of a YouTube video through the official IFrame API (youtube-nocookie.com).
// Nothing is downloaded: YouTube streams the video, Shifu only says where to start and stop.

import { useEffect, useRef } from "react";
import styles from "./player.module.css";

let api: Promise<typeof YT> | null = null;

function loadApi(): Promise<typeof YT> {
  api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as typeof YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return api;
}

interface Props {
  videoId: string;
  start: number;
  end: number;
  /** Called when playback reaches the end of the span. */
  onEnded?: () => void;
}

export function YouTubeClip({ videoId, start, end, onEnded }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YT.Player | null>(null);
  const ended = useRef(onEnded);

  useEffect(() => {
    ended.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    let cancelled = false;
    loadApi().then((yt) => {
      if (cancelled || !host.current) return;
      const span = { videoId, startSeconds: Math.floor(start), endSeconds: Math.ceil(end) };
      if (player.current) {
        player.current.loadVideoById(span);
        return;
      }
      // The API replaces the element it is given, so give it one React doesn't own.
      const mount = document.createElement("div");
      host.current.appendChild(mount);
      player.current = new yt.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: { start: span.startSeconds, end: span.endSeconds, rel: 0, playsinline: 1, autoplay: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === yt.PlayerState.ENDED) ended.current?.();
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoId, start, end]);

  useEffect(
    () => () => {
      player.current?.destroy();
      player.current = null;
    },
    [],
  );

  return <div className={styles.frame} ref={host} />;
}
