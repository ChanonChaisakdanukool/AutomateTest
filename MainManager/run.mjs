import { fileURLToPath } from 'node:url';
import { runAutomation } from './runner.mjs';

const defaultRunPath = fileURLToPath(new URL('../Config/Local/RunConfig.json', import.meta.url));

function parseArguments(args) {
  if (args.length === 0) {
    return { testCasePath: defaultRunPath };
  }
  if (args.length === 2 && args[0] === '--config' && args[1]) {
    return { testCasePath: args[1] };
  }
  if (args.length !== 4) {
    throw new Error('Usage: node MainManager/run.mjs --device DeviceConfig.json --testcase TestCaseConfig.json');
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--device', '--testcase'].includes(flag) || options[flag] || !args[index + 1]) {
      throw new Error('Provide --device and --testcase once each.');
    }
    options[flag] = args[index + 1];
  }
  return { devicePath: options['--device'], testCasePath: options['--testcase'] };
}

try {
  const summary = await runAutomation(parseArguments(process.argv.slice(2)));
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.status === 'PASS' ? 0 : summary.status === 'FAIL' ? 1 : 2;
} catch (error) {
  console.error(JSON.stringify({ status: 'ERROR', phase: 'preflight', message: error.message }, null, 2));
  process.exitCode = 2;
}
