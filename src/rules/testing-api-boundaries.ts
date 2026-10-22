import { dependencyRule } from '../utils/dependencies.js';
import { matches, relative, inCore, targetMatches, isTest } from '../utils/config.js';

export default dependencyRule({
  name: 'testing-api-boundaries', description: 'Keep designated business tests behind a testing API',
  chapters: [28], principle: 'Testing API', scopes: ['businessTests', 'testingApi'],
  check(config, source, dependency) {
    if (!matches(relative(config, source), config.businessTests)) return;
    if (dependency.target && (matches(relative(config, dependency.target), config.testingApi) || isTest(config, dependency.target))) return;
    const infrastructure = Object.values(config.infrastructure ?? {}).flat();
    if ((dependency.target && inCore(config, dependency.target)) ||
      targetMatches(config, infrastructure, dependency.specifier, dependency.target)) {
      return `Business test must access ${dependency.specifier} through the declared testing API`;
    }
  },
});
