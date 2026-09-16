/**
 * Graviton V1.9.0 Port Guard & Daemon Test Suite
 */

import assert from 'assert';
import http from 'http';
import { spawn } from 'child_process';
import {
  findProcessOnPort,
  killProcessTree,
  killProcessOnPort,
  startBackgroundDaemon,
  stopDaemonOrPort,
  listActivePorts
} from '../src/port-guard.js';

async function runTests() {
  console.log('=== STARTING V1.9.0 PORT GUARD & DAEMON TEST SUITE ===\n');

  // [TEST 1] Active Port Detection
  console.log('[TEST 1] Find Process On Port');
  const TEST_PORT_1 = 49152;
  const server1 = http.createServer((req, res) => res.end('ok'));
  
  await new Promise((resolve) => server1.listen(TEST_PORT_1, resolve));
  
  const foundInfo = findProcessOnPort(TEST_PORT_1);
  assert.ok(foundInfo, 'findProcessOnPort should detect active listening PID');
  assert.strictEqual(foundInfo.pid, process.pid, 'Detected PID should match current node process');
  console.log('  ✔ Correctly detected active listening PID on port ' + TEST_PORT_1 + ': ' + foundInfo.pid);

  await new Promise((resolve) => server1.close(resolve));
  
  // Verify port is freed
  const freedInfo = findProcessOnPort(TEST_PORT_1);
  assert.strictEqual(freedInfo, null, 'Port should be null after server close');
  console.log('  ✔ Verified port freed after close');

  // [TEST 2] Kill Process on Port (Child Process)
  console.log('\n[TEST 2] Kill Process on Port (Child Process)');
  const TEST_PORT_2 = 49153;
  // Spawn detached child process that listens on TEST_PORT_2
  const childScript = `
    const http = require('http');
    const server = http.createServer((req, res) => res.end('child'));
    server.listen(${TEST_PORT_2}, () => {
      console.log('CHILD_READY');
    });
  `;

  const child = spawn(process.execPath, ['-e', childScript], {
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: true
  });

  await new Promise((resolve) => {
    child.stdout.on('data', (data) => {
      if (data.toString().includes('CHILD_READY')) {
        resolve();
      }
    });
  });

  const childDetected = findProcessOnPort(TEST_PORT_2);
  assert.ok(childDetected, 'Child process should be found on port ' + TEST_PORT_2);
  console.log('  ✔ Child process running on port ' + TEST_PORT_2 + ' with PID: ' + childDetected.pid);

  const killResult = killProcessOnPort(TEST_PORT_2);
  assert.strictEqual(killResult.freed, true, 'killProcessOnPort should report freed = true');
  console.log('  ✔ Successfully killed process holding port ' + TEST_PORT_2);

  // Allow OS a brief moment to update sockets
  await new Promise((r) => setTimeout(r, 800));
  const postKillInfo = findProcessOnPort(TEST_PORT_2);
  assert.strictEqual(postKillInfo, null, 'Port should be unoccupied after killProcessOnPort');
  console.log('  ✔ Verified port ' + TEST_PORT_2 + ' is completely released');

  // [TEST 3] Start & Stop Background Daemon
  console.log('\n[TEST 3] Start & Stop Background Daemon');
  const dummyCmd = `node -e "setInterval(() => {}, 1000)"`;
  const startResult = startBackgroundDaemon(dummyCmd, process.cwd());
  assert.ok(startResult.success, 'Daemon should start successfully');
  assert.ok(startResult.pid, 'Daemon should return a PID');
  console.log('  ✔ Daemon started successfully with PID: ' + startResult.pid);

  // Stop daemon by PID
  const stopResults = stopDaemonOrPort(startResult.pid.toString());
  assert.ok(Array.isArray(stopResults) && stopResults.length > 0, 'stopDaemonOrPort should return results array');
  assert.strictEqual(stopResults[0].status, 'stopped', 'stopDaemonOrPort should report status stopped');
  console.log('  ✔ Daemon cleanly stopped and removed from daemon registry');

  // [TEST 4] listActivePorts
  console.log('\n[TEST 4] Scan Active Ports');
  const portStatuses = listActivePorts();
  assert.ok(Array.isArray(portStatuses), 'listActivePorts should return an array');
  assert.ok(portStatuses.length > 0, 'listActivePorts should check default dev ports');
  console.log('  ✔ Scanned dev ports (' + portStatuses.map(p => p.port).join(', ') + ')');

  console.log('\n=== ALL V1.9.0 PORT GUARD & DAEMON TESTS PASSED! ===\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
