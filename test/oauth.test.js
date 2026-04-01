import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowserOpenCommands, buildCurlCommand } from '../src/lib/oauth.js';

test('buildBrowserOpenCommands avoids cmd start for qwen oauth URLs on windows', () => {
  const url = 'https://chat.qwen.ai/authorize?user_code=0QY6QD_M&client=qwen-code';
  const commands = buildBrowserOpenCommands(url, 'win32');

  assert.deepEqual(commands[0], ['explorer.exe', [url]]);
  assert.equal(commands.some(([command]) => command === 'cmd'), false);
});

test('buildCurlCommand uses curl.exe on windows and preserves form body', () => {
  const request = buildCurlCommand(
    'https://chat.qwen.ai/api/v1/oauth2/device/code',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json'
      },
      body: 'client_id=abc&scope=openid'
    },
    'win32'
  );

  assert.equal(request.command, 'curl.exe');
  assert.deepEqual(request.args.slice(0, 8), [
    '--silent',
    '--show-error',
    '--location',
    '--request',
    'POST',
    '--output',
    '-',
    '--write-out'
  ]);
  assert.equal(request.args.includes('client_id=abc&scope=openid'), true);
});
