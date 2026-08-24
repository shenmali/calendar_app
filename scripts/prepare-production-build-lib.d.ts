declare module '@/scripts/prepare-production-build-lib.mjs' {
  export function shouldPrepareProductionBuild(environment: {
    VERCEL?: string;
    VERCEL_ENV?: string;
  }): boolean;
}
