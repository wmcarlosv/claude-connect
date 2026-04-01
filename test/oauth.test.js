import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowserOpenCommands } from '../src/lib/oauth.js';

test('buildBrowserOpenCommands avoids cmd start for qwen oauth URLs on windows', () => {
  const url = 'https://chat.qwen.ai/authorize?user_code=0QY6QD_M&client=qwen-code';
  const commands = buildBrowserOpenCommands(url, 'win32');

  assert.deepEqual(commands[0], ['explorer.exe', [url]]);
  assert.equal(commands.some(([command]) => command === 'cmd'), false);
});
