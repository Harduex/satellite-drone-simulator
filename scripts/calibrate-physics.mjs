import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const args = process.argv.slice(2);
let output = '.local/calibration/latest', baseline, inputFile, verify = false;
for (let i = 0; i < args.length; i++) {
  const [key, inline] = args[i].split('=', 2);
  if (key === '--verify') verify = true;
  else if (key === '--output' || key === '--baseline' || key === '--input') {
    const value = inline ?? args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${key} requires a directory`);
    if (key === '--output') output = value;
    else if (key === '--baseline') baseline = value;
    else inputFile = value;
  } else throw new Error(`Unknown argument ${key}`);
}
const outputDir = resolve(output);
const baselineDir = baseline ? resolve(baseline) : null;
if (outputDir === baselineDir) throw new Error('Output must differ from the preserved baseline directory');
// Reports can contain machine/runtime observations and raw telemetry; keep them out of commits.
execFileSync('git', ['check-ignore', '--quiet', join(outputDir, 'report.json')]);
await mkdir(outputDir, { recursive: true });
const server = await createServer({ root, configFile: false, appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
try {
  const { replayFlight, replayToCsv } = await server.ssrLoadModule('/src/core/calibration/FlightReplay.ts');
  const { calibrationScenarios, convergenceScenario } = await server.ssrLoadModule('/src/core/calibration/Scenarios.ts');
  const { staticBenchErrors, compareReplays, summarizeReplay, stateErrors } = await server.ssrLoadModule('/src/core/calibration/CalibrationMetrics.ts');
  const { PHYSICS_PROVENANCE, FIXED_PHYSICS_PROVENANCE } = await server.ssrLoadModule('/src/core/calibration/ParameterProvenance.ts');
  const { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } = await server.ssrLoadModule('/src/core/physics/droneConfig.ts');
  const { DEFAULT_ACTUAL_RATES } = await server.ssrLoadModule('/src/core/flight-controller/RatesConfig.ts');
  const { createDefaultDroneState } = await server.ssrLoadModule('/src/core/physics/types.ts');
  const { benchmarkCore } = await server.ssrLoadModule('/src/core/calibration/CoreBenchmark.ts');
  const baselineRuns = baselineDir ? JSON.parse(await readFile(join(baselineDir, 'replays.json'), 'utf8')) : null;
  const baselineReport = baselineDir ? JSON.parse(await readFile(join(baselineDir, 'report.json'), 'utf8')) : null;
  if (baselineReport && (!baselineReport.physicsConfig || baselineReport.schemaVersion !== 1)) throw new Error('Invalid baseline report/configuration');
  const scenarios = calibrationScenarios();
  if (inputFile) scenarios.custom = JSON.parse(await readFile(resolve(inputFile), 'utf8'));
  if (baselineRuns && JSON.stringify(Object.keys(baselineRuns).sort()) !== JSON.stringify(Object.keys(scenarios).sort())) {
    throw new Error('Baseline scenario set differs; capture a compatible baseline');
  }
  const replays = {}, runs = {};
  for (const [name, options] of Object.entries(scenarios)) {
    const replay = replayFlight(options);
    const repeat = replayFlight(options);
    const serialized = JSON.stringify(replay);
    if (serialized !== JSON.stringify(repeat)) throw new Error(`Nondeterministic scenario: ${name}`);
    replays[name] = replay;
    runs[name] = { ...summarizeReplay(replay), deterministic: true,
      sha256: createHash('sha256').update(serialized).digest('hex'),
      baselineDifference: baselineRuns ? compareReplays(baselineRuns[name], replay) : null };
    await writeFile(join(outputDir, `${name}.csv`), replayToCsv(replay));
  }
  await writeFile(join(outputDir, 'replays.json'), JSON.stringify(replays));
  const reference = replayFlight(convergenceScenario(2000));
  const convergence = [250, 500, 1000].map(hz => {
    const replay = replayFlight(convergenceScenario(hz));
    return { hz, ...stateErrors(reference.samples.at(-1).state, replay.samples.at(-1).state) };
  });
  const ballisticConvergence = [250, 500, 1000].map(hz => {
    const replay = replayFlight({ ...scenarios.coast, dt: 1 / hz, initialState: createDefaultDroneState(100),
      physicsConfig: { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0, rotorDragCoefficient: 0 },
      inputs: { kind: 'motors', samples: Array.from({ length: hz }, () => ({ m1: 0, m2: 0, m3: 0, m4: 0 })) } });
    return { hz, positionErrorM: Math.abs(replay.samples.at(-1).state.position.z - (100 - 9.81 / 2)) };
  });
  const effectSensitivity = ['wind', 'propwash', 'near-ground'].map(name => {
    const options = scenarios[name];
    const off = replayFlight({ ...options, effects: { ...options.effects, wind: false, propwash: false, groundEffect: false } });
    return { name, interpretation: 'Synthetic ON/OFF sensitivity, not measured physical accuracy',
      ...stateErrors(replays[name].samples.at(-1).state, off.samples.at(-1).state) };
  });
  const actualRates = { ...DEFAULT_RATES, model: 'actual', actual: DEFAULT_ACTUAL_RATES };
  const actualRuns = Object.fromEntries(Object.entries(calibrationScenarios(actualRates)).filter(([, o]) => o.inputs.kind === 'sticks')
    .map(([name, options]) => [name, summarizeReplay(replayFlight(options))]));
  const heapBefore = process.memoryUsage().heapUsed;
  const coreTiming = benchmarkCore();
  const actualCoreTiming = benchmarkCore(actualRates);
  const heapAfter = process.memoryUsage().heapUsed;
  let verification = { status: 'not-run', command: 'Pass --verify to run full tests and build', tests: null, build: null };
  if (verify) {
    const testFile = join(outputDir, 'tests.json');
    const tests = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', `--outputFile=${testFile}`], { encoding: 'utf8' });
    await writeFile(join(outputDir, 'tests.log'), tests.stdout + tests.stderr);
    const testResults = tests.status === 0 ? JSON.parse(await readFile(testFile, 'utf8')) : null;
    const typecheck = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { encoding: 'utf8' });
    const build = typecheck.status === 0 ? spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { encoding: 'utf8' }) : null;
    await writeFile(join(outputDir, 'build.log'), typecheck.stdout + typecheck.stderr + (build ? build.stdout + build.stderr : ''));
    verification = { status: tests.status === 0 && build?.status === 0 ? 'passed' : 'failed',
      tests: { exitCode: tests.status, passed: testResults?.numPassedTests ?? null, failed: testResults?.numFailedTests ?? null,
        calibrationCases: testResults?.testResults.filter(file => /calibration|ActualRates|RatesSettings|GameLoop.test/.test(file.name))
          .flatMap(file => file.assertionResults.map(test => ({ name: test.fullName, status: test.status }))) ?? [] },
      build: { typecheckExitCode: typecheck.status, buildExitCode: build?.status ?? null } };
  }
  const parameters = Object.fromEntries(Object.entries(DEFAULT_DRONE_CONFIG).map(([key, value]) => [key, {
    before: baselineReport ? baselineReport.physicsConfig[key] ?? null : null, after: value, ...PHYSICS_PROVENANCE[key],
    holdoutError: null, decision: !baselineReport ? 'no baseline supplied' : JSON.stringify(baselineReport.physicsConfig[key]) === JSON.stringify(value)
      ? 'unchanged; no matched-airframe flight measurements supplied' : 'changed; measured holdout improvement must be established separately',
  }]));
  const changedParameters = baselineReport ? Object.keys(parameters).filter(key => JSON.stringify(parameters[key].before) !== JSON.stringify(parameters[key].after)) : null;
  const staticBench = staticBenchErrors(DEFAULT_DRONE_CONFIG);
  const report = { schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
    runtime: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown' },
    physicsConfig: DEFAULT_DRONE_CONFIG, ratesConfig: DEFAULT_RATES, parameters, fixedPhysicsProvenance: FIXED_PHYSICS_PROVENANCE,
    staticBench, staticBenchBaseline: baselineReport ? staticBenchErrors(baselineReport.physicsConfig) : null, changedParameters,
    runs, actualRates, actualRuns, convergence: { referenceHz: 2000, durationSeconds: 1, results: convergence }, ballisticConvergence, effectSensitivity,
    coreTiming, coreTimingBaseline: baselineReport?.coreTiming ?? null, actualCoreTiming,
    coreTimingChangePct: baselineReport?.coreTiming ? 100 * (coreTiming.meanMs / baselineReport.coreTiming.meanMs - 1) : null,
    memory: { heapBefore, heapAfter, deltaBytes: heapAfter - heapBefore,
      interpretation: 'Observed Node heap across both benchmarks, includes runtime/GC; not allocated bytes per physics tick or a leak test' },
    verification, browser: { status: 'not-measured', fps: null },
    realFlight: { trainError: null, holdoutError: null, confidenceIntervals: null, reason: 'No matched real-flight recordings supplied' } };
  await writeFile(join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const markdown = `# Physics calibration report\n\nSource: ${report.sourceCommit}; dirty: ${report.sourceDirty}.\n\n` +
    `Static bench: max RPM error ${staticBench.maxAbsRpmErrorPct}%; max thrust error ${staticBench.maxAbsThrustErrorPct}%.\n\n` +
    `Synthetic replays: ${Object.keys(runs).length}; deterministic: all. Baseline supplied: ${Boolean(baselineRuns)}.\n\n` +
    `Core step p50/p95/p99: ${coreTiming.p50Ms}/${coreTiming.p95Ms}/${coreTiming.p99Ms} ms. ${coreTiming.limitations}\n\n` +
    `Verification: ${verification.status}. Browser FPS not measured. Real-flight train/holdout errors unavailable.\n\n` +
    `Changed physics settings: ${changedParameters === null ? 'baseline unavailable' : changedParameters.length ? changedParameters.join(', ') : 'none'}. Synthetic replay differences and static bench fit do not establish improved flight realism. See report.json for provenance, before/after metrics and limitations; replays.json and scenario CSVs retain every full-precision step.\n`;
  await writeFile(join(outputDir, 'report.md'), markdown);
  console.log(JSON.stringify({ output, staticBench: { rpmPct: staticBench.maxAbsRpmErrorPct, thrustPct: staticBench.maxAbsThrustErrorPct },
    scenarios: Object.keys(runs).length, maxBaselinePositionDifferenceM: baselineRuns ? Math.max(...Object.values(runs).map(r => r.baselineDifference.maxPositionErrorM)) : null,
    coreTiming, verification: { status: verification.status,
      tests: verification.tests ? { passed: verification.tests.passed, failed: verification.tests.failed } : null, build: verification.build } }, null, 2));
  if (verification.status === 'failed' || staticBench.maxAbsRpmErrorPct >= 6 || staticBench.maxAbsThrustErrorPct >= 10) process.exitCode = 1;
} finally { await server.close(); }
