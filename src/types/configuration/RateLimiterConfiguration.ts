export default interface ShieldConfiguration {
  active: boolean;
  rateLimiters: RateLimiterConfiguration[];
}

export interface RateLimiterConfiguration {
  name: string;
  numberOfPoints: number;
  numberOfSeconds: number;
}
