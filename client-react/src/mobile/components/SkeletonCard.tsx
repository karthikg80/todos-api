import { TarotCardFront } from "../../components/home/TarotCard";
import { GenerativePattern } from "../../components/GenerativePattern";
import { FlameArt, SunriseArt } from "../../components/home/pixel-art";
import type { ReactNode } from "react";

interface Props {
  name: string;
  subtitle: string;
  numeral: string;
  source: "ai" | "sys";
}

const ILLUSTRATIONS: Record<string, (size: number) => ReactNode> = {
  "The Flame": (size) => <FlameArt size={size} />,
  "The Dawn": (size) => <SunriseArt size={size} />,
};

function ShimmerContent() {
  return (
    <div className="m-shimmer-content">
      <div className="m-shimmer-bar m-shimmer-bar--wide" />
      <div className="m-shimmer-bar m-shimmer-bar--medium" />
      <div className="m-shimmer-bar m-shimmer-bar--narrow" />
    </div>
  );
}

export function SkeletonCard({ name, subtitle, numeral, source }: Props) {
  const illustrationFn = ILLUSTRATIONS[name];
  const illustration = illustrationFn ? illustrationFn(64) : null;

  return (
    <div className="m-skeleton-card">
      <GenerativePattern
        mode="flowField"
        seed={7}
        color="#8a7e6e"
        background="transparent"
        opacity={0.06}
        density={20}
        width="100%"
        height={600}
        className="m-skeleton-card__pattern"
      />
      <TarotCardFront
        name={name}
        subtitle={subtitle}
        numeral={numeral}
        source={source}
        illustration={illustration}
        hero
      >
        <ShimmerContent />
      </TarotCardFront>
    </div>
  );
}
