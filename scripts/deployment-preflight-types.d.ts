declare module '@/scripts/deployment-preflight.mjs' {
  export const requiredDeploymentEnvironmentVariables: readonly string[];

  export function validateDeploymentEnvironment(
    environment: Record<string, string | undefined>,
  ): string[];
}
