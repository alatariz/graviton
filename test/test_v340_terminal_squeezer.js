// test/test_v340_terminal_squeezer.js - Graviton V3.4.0 Terminal & Test Runner Squeezer Unit Tests
import assert from 'assert';
import {
  isTestOutput,
  isBuildOutput,
  condenseTestOutput,
  condenseBuildOutput,
  squeezeMixedContent
} from '../src/stack-squeezer.js';
import { filterCliOutput } from '../src/cli-filter.js';
import { estimateTokens } from '../src/pipeline.js';

console.log('\n===============================================================');
console.log('   GRAVITON V3.4.0 TERMINAL & TEST RUNNER SQUEEZER TEST SUITE');
console.log('===============================================================\n');

// -----------------------------------------------------------------------------
// [TEST 1] Jest / Vitest Mixed Output with 1 Failure and 25 Passing Tests
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing Jest / Vitest test output condensing with failures...');
const noisyJestOutput = `
PASS src/math.test.js
  ✓ adds numbers correctly (2 ms)
  ✓ subtracts numbers correctly (1 ms)
  ✓ multiplies numbers correctly (1 ms)
  ✓ divides numbers correctly (2 ms)
  ✓ handles floating point numbers (3 ms)
PASS src/utils.test.js
  ✓ formats date strings (2 ms)
  ✓ parses urls (1 ms)
  ✓ sanitizes html (4 ms)
  ✓ truncates long strings (1 ms)
  ✓ generates random ids (2 ms)
FAIL src/auth.test.js
  ✓ validates email format (2 ms)
  ✕ rejects invalid tokens (15 ms)

  ● rejects invalid tokens

    expect(received).toBe(expected) // Object.is equality

    Expected: 401
    Received: 500

      14 |   const res = await authenticateUser(invalidToken);
    > 15 |   expect(res.status).toBe(401);
         |                      ^
      16 | });

      at Object.<anonymous> (src/auth.test.js:15:22)
      at Promise.then.completed (node_modules/jest-circus/build/utils.js:391:28)
      at new Promise (<anonymous>)
      at callAsyncCircusFn (node_modules/jest-circus/build/utils.js:316:10)
      at _callCircusTest (node_modules/jest-circus/build/run.js:218:40)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)

Test Suites: 1 failed, 2 passed, 3 total
Tests:       1 failed, 11 passed, 12 total
Snapshots:   0 total
Time:        3.456 s
Ran all test suites.
`;

assert(isTestOutput(noisyJestOutput), 'isTestOutput must identify Jest test runner output');

const condensedJest = condenseTestOutput(noisyJestOutput);
assert(condensedJest.includes('1 failed'), 'Must indicate failed test count');
assert(condensedJest.includes('passing tests collapsed'), 'Must collapse passing tests');
assert(condensedJest.includes('rejects invalid tokens'), 'Must preserve failure name');
assert(condensedJest.includes('Expected: 401'), 'Must preserve expected diff');
assert(condensedJest.includes('Received: 500'), 'Must preserve received diff');
assert(condensedJest.includes('src/auth.test.js:15:22'), 'Must preserve source file location');
assert(condensedJest.includes('internal library frames collapsed'), 'Must collapse jest-circus and internal frames');
assert(!condensedJest.includes('adds numbers correctly'), 'Should not waste tokens listing passing tests');

const rawTokens = estimateTokens(noisyJestOutput);
const condensedTokens = estimateTokens(condensedJest);
const tokenSavings = Math.round(((rawTokens - condensedTokens) / rawTokens) * 100);
console.log(`  Raw tokens: ${rawTokens} → Condensed: ${condensedTokens} (${tokenSavings}% token savings)`);
assert(tokenSavings > 30, 'Should save over 30% tokens on noisy test failure log');
console.log('✔ PASS: Jest / Vitest test failure output successfully condensed.\n');

// -----------------------------------------------------------------------------
// [TEST 2] Jest / Vitest 100% Passing Suite (Massive Token Compression)
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing 100% passing test suite (ultra-compact 1-line confirmation)...');
const allPassingJest = `
PASS src/components/button.test.jsx (1.2s)
  ✓ renders button text (5ms)
  ✓ handles onClick event (8ms)
  ✓ applies disabled state (4ms)
PASS src/components/modal.test.jsx (2.1s)
  ✓ renders modal header (10ms)
  ✓ closes on escape key (12ms)
  ✓ traps focus properly (18ms)
PASS src/services/api.test.js (0.8s)
  ✓ makes GET request (15ms)
  ✓ handles 404 response (11ms)
  ✓ retries on network error (25ms)

Test Suites: 3 passed, 3 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        4.512 s
Ran all test suites.
`;

const condensedPassing = condenseTestOutput(allPassingJest);
assert(condensedPassing.startsWith('✔'), 'Must start with success checkmark');
assert(condensedPassing.includes('passed'), 'Must state tests passed');
assert(condensedPassing.includes('0 failures'), 'Must confirm 0 failures');
assert(!condensedPassing.includes('handles onClick event'), 'Must not list individual passing tests');

const rawPassTokens = estimateTokens(allPassingJest);
const condensedPassTokens = estimateTokens(condensedPassing);
const passSavings = Math.round(((rawPassTokens - condensedPassTokens) / rawPassTokens) * 100);
console.log(`  Raw tokens: ${rawPassTokens} → Condensed: ${condensedPassTokens} (${passSavings}% token savings)`);
assert(passSavings > 75, 'Should save over 75% tokens when all tests pass');
console.log('✔ PASS: 100% passing test suite collapsed to single-line verification.\n');

// -----------------------------------------------------------------------------
// [TEST 3] Python pytest Output (Passing dots & failure block)
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing Python pytest output condensing...');
const pytestOutput = `
============================= test session starts =============================
platform linux -- Python 3.10.6, pytest-7.4.0
rootdir: /home/user/project
collected 15 items

tests/test_auth.py ..........                                            [ 66%]
tests/test_db.py ....F                                                   [100%]

================================== FAILURES ===================================
_________________________________ test_db_pool ________________________________

    def test_db_pool():
        pool = DatabasePool(max_connections=5)
>       assert pool.is_active() is True
E       AssertionError: assert False is True
E        +  where False = is_active()

tests/test_db.py:42: AssertionError
=========================== short test summary info ===========================
FAILED tests/test_db.py::test_db_pool - AssertionError: assert False is True
========================= 1 failed, 14 passed in 0.85s =========================
`;

assert(isTestOutput(pytestOutput), 'isTestOutput must identify pytest output');
const condensedPytest = condenseTestOutput(pytestOutput);
assert(condensedPytest.includes('AssertionError: assert False is True'), 'Must retain pytest failure and assertion message');
assert(condensedPytest.includes('tests/test_db.py:42'), 'Must retain pytest failure location');
assert(!condensedPytest.includes('tests/test_auth.py ..........'), 'Should collapse pytest passing dots');
console.log('✔ PASS: Python pytest output condensed.\n');

// -----------------------------------------------------------------------------
// [TEST 4] Go test & Rust cargo test outputs
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing Go and Rust test outputs...');
const goTestOutput = `
=== RUN   TestCalculatorAdd
--- PASS: TestCalculatorAdd (0.00s)
=== RUN   TestCalculatorMultiply
--- PASS: TestCalculatorMultiply (0.00s)
=== RUN   TestCalculatorDivideByZero
    calc_test.go:35: Expected error on divide by zero, got nil
--- FAIL: TestCalculatorDivideByZero (0.00s)
FAIL
FAIL	github.com/example/calc	0.012s
FAIL
`;

assert(isTestOutput(goTestOutput), 'isTestOutput must identify go test output');
const condensedGo = condenseTestOutput(goTestOutput);
assert(condensedGo.includes('TestCalculatorDivideByZero'), 'Must isolate failing Go test');
assert(condensedGo.includes('Expected error on divide by zero'), 'Must retain failure log message');
assert(!condensedGo.includes('TestCalculatorAdd'), 'Must collapse passing Go test');

const cargoTestOutput = `
running 4 tests
test tests::test_addition ... ok
test tests::test_subtraction ... ok
test tests::test_multiplication ... ok
test tests::test_division ... FAILED

failures:

---- tests::test_division stdout ----
thread 'tests::test_division' panicked at src/lib.rs:52:9:
attempt to divide by zero
note: run with RUST_BACKTRACE=1 environment variable to display a backtrace

failures:
    tests::test_division

test result: FAILED. 3 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out
`;

assert(isTestOutput(cargoTestOutput), 'isTestOutput must identify cargo test output');
const condensedCargo = condenseTestOutput(cargoTestOutput);
assert(condensedCargo.includes('test_division'), 'Must isolate failing Rust test');
assert(condensedCargo.includes('attempt to divide by zero'), 'Must retain panic reason');
assert(!condensedCargo.includes('test tests::test_addition ... ok'), 'Must collapse passing Rust tests');
console.log('✔ PASS: Go and Rust test runner outputs successfully handled.\n');

// -----------------------------------------------------------------------------
// [TEST 5] Build & Bundler Chatter Condensing (Webpack, Vite, Cargo build)
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing build chatter & bundler progress stripping...');
const noisyCargoBuild = `
   Compiling libc v0.2.147
   Compiling proc-macro2 v1.0.66
   Compiling unicode-ident v1.0.11
   Compiling quote v1.0.32
   Compiling syn v2.0.28
   Compiling serde v1.0.180
   Compiling cfg-if v1.0.0
   Compiling memchr v2.5.0
   Compiling once_cell v1.18.0
   Compiling my-rust-app v0.1.0 (/workspace)
error[E0425]: cannot find value 'unresolved_symbol' in this scope
  --> src/main.rs:24:5
   |
24 |     unresolved_symbol();
   |     ^^^^^^^^^^^^^^^^^ not found in this scope

error: could not compile my-rust-app (bin "my-rust-app") due to 1 previous error
`;

assert(isBuildOutput(noisyCargoBuild), 'isBuildOutput must identify cargo build');
const condensedCargoBuild = condenseBuildOutput(noisyCargoBuild);
assert(condensedCargoBuild.includes('compiled 10 dependencies'), 'Must collapse 10 dependency compilations into 1 summary line');
assert(condensedCargoBuild.includes('error[E0425]'), 'Must preserve compiler error');
assert(condensedCargoBuild.includes('src/main.rs:24:5'), 'Must preserve file location and snippet');
assert(!condensedCargoBuild.includes('Compiling proc-macro2'), 'Must not spam individual dependency compilations');

const noisyViteBuild = `
[vite] hmr update /src/App.tsx
[=====================>    ] 75% transforming
[vite] hmr update /src/index.css
[==========================] 100%
✓ 48 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.30 kB
dist/assets/index-D7P21Vd.css     1.20 kB │ gzip:  0.65 kB
dist/assets/index-C8g2lPa.js     142.10 kB │ gzip: 45.30 kB
✓ built in 340ms
`;

const condensedVite = condenseBuildOutput(noisyViteBuild);
assert(!condensedVite.includes('[vite] hmr update'), 'Must strip HMR updates');
assert(!condensedVite.includes('75% transforming'), 'Must strip progress bar');
assert(condensedVite.includes('built in 340ms') || condensedVite.includes('dist/assets'), 'Must preserve build artifact summary');
console.log('✔ PASS: Build & bundler chatter successfully condensed.\n');

// -----------------------------------------------------------------------------
// [TEST 6] Mixed User Prompt Squeezing with Embedded Test Log
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing user prompt with embedded test runner output...');
const userPromptWithTests = `
I ran npm test and got this failure. Can you fix auth.js?

PASS src/math.test.js
  ✓ adds numbers correctly (2 ms)
  ✓ subtracts numbers correctly (1 ms)
FAIL src/auth.test.js
  ✕ rejects invalid tokens (15 ms)

  ● rejects invalid tokens

    expect(received).toBe(expected)

    Expected: 401
    Received: 500

      15 |   expect(res.status).toBe(401);

      at Object.<anonymous> (src/auth.test.js:15:22)
      at callAsyncCircusFn (node_modules/jest-circus/build/utils.js:316:10)
      at processTicksAndRejections (node:internal/process/task_queues:95:5)

Test Suites: 1 failed, 1 passed, 2 total
Tests:       1 failed, 2 passed, 3 total
`;

const mixedResult = squeezeMixedContent(userPromptWithTests);
assert(mixedResult.hasTrace, 'Must flag that content was squeezed');
assert(mixedResult.linesSaved >= 3, 'Must save multiple lines');
assert(mixedResult.squeezedText.includes('Can you fix auth.js?'), 'Must preserve user question');
assert(mixedResult.squeezedText.includes('Expected: 401'), 'Must preserve failure diff');
assert(!mixedResult.squeezedText.includes('adds numbers correctly'), 'Must collapse passing tests from user prompt');
console.log('✔ PASS: Mixed prompt with embedded test failure cleanly squeezed.\n');

// -----------------------------------------------------------------------------
// [TEST 7] filterCliOutput Command Dispatching
// -----------------------------------------------------------------------------
console.log('[TEST 7] Testing filterCliOutput dispatching for test and build commands...');
const filteredNpmTest = filterCliOutput('npm test', noisyJestOutput);
assert(filteredNpmTest.includes('[GRAVITON TEST SQUEEZER'), 'filterCliOutput must route npm test to test squeezer');
assert(filteredNpmTest.includes('Expected: 401'), 'filterCliOutput must preserve failure details');

const filteredCargoBuild = filterCliOutput('cargo build', noisyCargoBuild);
assert(filteredCargoBuild.includes('compiled 10 dependencies'), 'filterCliOutput must route cargo build to build squeezer');
assert(filteredCargoBuild.includes('error[E0425]'), 'filterCliOutput must preserve build errors');
console.log('✔ PASS: filterCliOutput correctly dispatches to specialized squeezers.\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V3.4.0 TERMINAL & TEST SQUEEZER TESTS PASSED 100%');
console.log('===============================================================\n');
