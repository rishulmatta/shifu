// The globals the YouTube IFrame API script defines (the YT namespace comes from @types/youtube).
interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
