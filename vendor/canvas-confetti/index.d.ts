export type Options = {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  scalar?: number;
  ticks?: number;
  gravity?: number;
  decay?: number;
  origin?: {
    x?: number;
    y?: number;
  };
  colors?: string[];
  zIndex?: number;
};

export default function confetti(options?: Options): Promise<null>;
