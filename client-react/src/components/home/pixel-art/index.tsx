import type { JSX } from "react";

interface ArtProps {
  size?: number;
}

export function FlameArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="7" y="1" width="2" height="2" fill="#ef4444" />
      <rect x="6" y="3" width="4" height="2" fill="#ef4444" />
      <rect x="5" y="5" width="6" height="2" fill="#f59e0b" />
      <rect x="5" y="7" width="6" height="2" fill="#f59e0b" />
      <rect x="6" y="9" width="4" height="2" fill="#fbbf24" />
      <rect x="7" y="11" width="2" height="2" fill="#fbbf24" />
    </svg>
  );
}

export function SunriseArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="6" y="2" width="4" height="2" fill="#fbbf24" />
      <rect x="4" y="4" width="8" height="2" fill="#f59e0b" />
      <rect x="3" y="6" width="10" height="2" fill="#f59e0b" />
      <rect x="2" y="8" width="12" height="1" fill="#e5e7eb" />
      <rect x="0" y="9" width="16" height="1" fill="#d1d5db" />
      <rect x="0" y="10" width="16" height="6" fill="#e5e7eb" />
    </svg>
  );
}

export function HourglassArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="4" y="1" width="8" height="2" fill="#6b7280" />
      <rect x="5" y="3" width="6" height="1" fill="#ef4444" />
      <rect x="6" y="4" width="4" height="1" fill="#ef4444" />
      <rect x="7" y="5" width="2" height="2" fill="#f59e0b" />
      <rect x="6" y="7" width="4" height="1" fill="#fbbf24" />
      <rect x="5" y="8" width="6" height="1" fill="#fbbf24" />
      <rect x="5" y="9" width="6" height="2" fill="#e5e7eb" />
      <rect x="4" y="11" width="8" height="2" fill="#6b7280" />
    </svg>
  );
}

export function CompassArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="5" y="1" width="6" height="1" fill="#4a7dff" />
      <rect x="3" y="2" width="10" height="1" fill="#4a7dff" />
      <rect x="2" y="3" width="12" height="10" fill="#e0e7ff" />
      <rect x="7" y="4" width="2" height="3" fill="#ef4444" />
      <rect x="7" y="8" width="2" height="3" fill="#d1d5db" />
      <rect x="3" y="13" width="10" height="1" fill="#4a7dff" />
      <rect x="5" y="14" width="6" height="1" fill="#4a7dff" />
    </svg>
  );
}

export function PapersArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="3" y="2" width="8" height="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
      <rect x="5" y="4" width="8" height="10" fill="#fefce8" stroke="#f59e0b" strokeWidth="1" />
      <rect x="6" y="6" width="4" height="1" fill="#d1d5db" />
      <rect x="6" y="8" width="3" height="1" fill="#d1d5db" />
      <rect x="6" y="10" width="5" height="1" fill="#d1d5db" />
    </svg>
  );
}

export function CobwebArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="0" y="0" width="1" height="16" fill="#d1d5db" opacity="0.5" />
      <rect x="0" y="0" width="16" height="1" fill="#d1d5db" opacity="0.5" />
      <rect x="1" y="1" width="1" height="1" fill="#9ca3af" />
      <rect x="3" y="3" width="1" height="1" fill="#9ca3af" />
      <rect x="5" y="5" width="1" height="1" fill="#9ca3af" />
      <rect x="7" y="7" width="2" height="2" fill="#6b7280" />
      <rect x="2" y="4" width="3" height="1" fill="#d1d5db" opacity="0.3" />
      <rect x="4" y="2" width="1" height="3" fill="#d1d5db" opacity="0.3" />
    </svg>
  );
}

export function SleepyCatArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="3" y="5" width="2" height="2" fill="#8b5cf6" />
      <rect x="11" y="5" width="2" height="2" fill="#8b5cf6" />
      <rect x="4" y="7" width="8" height="4" fill="#a78bfa" />
      <rect x="3" y="8" width="10" height="3" fill="#a78bfa" />
      <rect x="6" y="8" width="1" height="1" fill="#1f2937" />
      <rect x="9" y="8" width="1" height="1" fill="#1f2937" />
      <rect x="7" y="9" width="2" height="1" fill="#ec4899" />
      <rect x="2" y="11" width="12" height="2" fill="#a78bfa" />
      <rect x="13" y="10" width="2" height="1" fill="#a78bfa" />
    </svg>
  );
}

export function RoadArt({ size = 64 }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ imageRendering: "pixelated" }}>
      <rect x="0" y="12" width="16" height="4" fill="#4ade80" />
      <rect x="3" y="10" width="10" height="2" fill="#9ca3af" />
      <rect x="5" y="8" width="6" height="2" fill="#9ca3af" />
      <rect x="6" y="6" width="4" height="2" fill="#9ca3af" />
      <rect x="7" y="4" width="2" height="2" fill="#9ca3af" />
      <rect x="7" y="11" width="2" height="1" fill="#fbbf24" />
      <rect x="7" y="9" width="2" height="1" fill="#fbbf24" />
      <rect x="7" y="7" width="2" height="1" fill="#fbbf24" />
    </svg>
  );
}

// Panel type → art component mapping
export const PANEL_ART: Record<string, (props: ArtProps) => JSX.Element> = {
  rightNow: FlameArt,
  todayAgenda: SunriseArt,
  dueSoon: HourglassArt,
  whatNext: CompassArt,
  unsorted: PapersArt,
  backlogHygiene: CobwebArt,
  projectsToNudge: SleepyCatArt,
  trackOverview: RoadArt,
};
