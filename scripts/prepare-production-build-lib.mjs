export function shouldPrepareProductionBuild(environment) {
  return environment.VERCEL === '1' && environment.VERCEL_ENV === 'production';
}
