import { validateDeploymentEnvironment } from './deployment-preflight.mjs';
import { shouldPrepareProductionBuild } from './prepare-production-build-lib.mjs';

if (shouldPrepareProductionBuild(process.env)) {
  const issues = validateDeploymentEnvironment(process.env);
  if (issues.length > 0) {
    for (const issue of issues) console.error(`- ${issue}`);
    throw new Error('Production build preparation failed.');
  }

  await import('./provision-owner.mjs');
}
