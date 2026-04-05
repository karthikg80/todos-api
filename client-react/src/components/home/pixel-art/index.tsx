import type { JSX } from "react";

interface ArtProps {
  size?: number;
}

export function FlameArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="7" y="1" width="2" height="2" fill="#c45a3c" />
      <rect x="6" y="3" width="4" height="2" fill="#c45a3c" />
      <rect x="5" y="5" width="6" height="2" fill="#d4864a" />
      <rect x="5" y="7" width="6" height="2" fill="#d4864a" />
      <rect x="6" y="9" width="4" height="2" fill="#daa85c" />
      <rect x="7" y="11" width="2" height="2" fill="#daa85c" />
    </svg>
  );
}

export function SunriseArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="6" y="2" width="4" height="2" fill="#daa85c" />
      <rect x="4" y="4" width="8" height="2" fill="#d4864a" />
      <rect x="3" y="6" width="10" height="2" fill="#d4864a" />
      <rect x="2" y="8" width="12" height="1" fill="#e0dbd3" />
      <rect x="0" y="9" width="16" height="1" fill="#d0c8b8" />
      <rect x="0" y="10" width="16" height="6" fill="#e0dbd3" />
    </svg>
  );
}

export function HourglassArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="4" y="1" width="8" height="2" fill="#8a8a7e" />
      <rect x="5" y="3" width="6" height="1" fill="#c45a3c" />
      <rect x="6" y="4" width="4" height="1" fill="#c45a3c" />
      <rect x="7" y="5" width="2" height="2" fill="#d4864a" />
      <rect x="6" y="7" width="4" height="1" fill="#daa85c" />
      <rect x="5" y="8" width="6" height="1" fill="#daa85c" />
      <rect x="5" y="9" width="6" height="2" fill="#e0dbd3" />
      <rect x="4" y="11" width="8" height="2" fill="#8a8a7e" />
    </svg>
  );
}

export function CompassArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="5" y="1" width="6" height="1" fill="#6a7a9a" />
      <rect x="3" y="2" width="10" height="1" fill="#6a7a9a" />
      <rect x="2" y="3" width="12" height="10" fill="#d8dce8" />
      <rect x="7" y="4" width="2" height="3" fill="#c45a3c" />
      <rect x="7" y="8" width="2" height="3" fill="#d0c8b8" />
      <rect x="3" y="13" width="10" height="1" fill="#6a7a9a" />
      <rect x="5" y="14" width="6" height="1" fill="#6a7a9a" />
    </svg>
  );
}

export function PapersArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect
        x="3"
        y="2"
        width="8"
        height="10"
        fill="#f0e8d8"
        stroke="#d4864a"
        strokeWidth="1"
      />
      <rect
        x="5"
        y="4"
        width="8"
        height="10"
        fill="#f5efe5"
        stroke="#d4864a"
        strokeWidth="1"
      />
      <rect x="6" y="6" width="4" height="1" fill="#d0c8b8" />
      <rect x="6" y="8" width="3" height="1" fill="#d0c8b8" />
      <rect x="6" y="10" width="5" height="1" fill="#d0c8b8" />
    </svg>
  );
}

export function CobwebArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="0" y="0" width="1" height="16" fill="#d0c8b8" opacity="0.5" />
      <rect x="0" y="0" width="16" height="1" fill="#d0c8b8" opacity="0.5" />
      <rect x="1" y="1" width="1" height="1" fill="#9a968e" />
      <rect x="3" y="3" width="1" height="1" fill="#9a968e" />
      <rect x="5" y="5" width="1" height="1" fill="#9a968e" />
      <rect x="7" y="7" width="2" height="2" fill="#8a8a7e" />
      <rect x="2" y="4" width="3" height="1" fill="#d0c8b8" opacity="0.3" />
      <rect x="4" y="2" width="1" height="3" fill="#d0c8b8" opacity="0.3" />
    </svg>
  );
}

export function SleepyCatArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="3" y="5" width="2" height="2" fill="#7a6a9a" />
      <rect x="11" y="5" width="2" height="2" fill="#7a6a9a" />
      <rect x="4" y="7" width="8" height="4" fill="#9a8ab8" />
      <rect x="3" y="8" width="10" height="3" fill="#9a8ab8" />
      <rect x="6" y="8" width="1" height="1" fill="#3d3730" />
      <rect x="9" y="8" width="1" height="1" fill="#3d3730" />
      <rect x="7" y="9" width="2" height="1" fill="#c45a7a" />
      <rect x="2" y="11" width="12" height="2" fill="#9a8ab8" />
      <rect x="13" y="10" width="2" height="1" fill="#9a8ab8" />
    </svg>
  );
}

export function RoadArt({ size = 64 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="0" y="12" width="16" height="4" fill="#8a9a8e" />
      <rect x="3" y="10" width="10" height="2" fill="#9a968e" />
      <rect x="5" y="8" width="6" height="2" fill="#9a968e" />
      <rect x="6" y="6" width="4" height="2" fill="#9a968e" />
      <rect x="7" y="4" width="2" height="2" fill="#9a968e" />
      <rect x="7" y="11" width="2" height="1" fill="#daa85c" />
      <rect x="7" y="9" width="2" height="1" fill="#daa85c" />
      <rect x="7" y="7" width="2" height="1" fill="#daa85c" />
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
  rescueMode: FlameArt,
};
