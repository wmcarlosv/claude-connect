import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNvidiaCodingModels, isNvidiaCodingModel } from '../src/lib/nvidia.js';

test('isNvidiaCodingModel accepts coding-oriented model metadata', () => {
  assert.equal(isNvidiaCodingModel({ id: 'qwen/qwen3-coder-480b-a35b-instruct' }), true);
  assert.equal(isNvidiaCodingModel({ id: 'moonshotai/kimi-k2.5', description: 'coding agent' }), true);
  assert.equal(isNvidiaCodingModel({ id: 'black-forest-labs/flux.1-dev', description: 'image generation' }), false);
});

test('fetchNvidiaCodingModels maps only coding models from /models', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://integrate.api.nvidia.com/v1/models');
    assert.equal(options.headers.authorization, 'Bearer nvidia-secret');

    return new Response(JSON.stringify({
      data: [
        {
          id: 'moonshotai/kimi-k2.5',
          name: 'Kimi K2.5',
          owned_by: 'moonshotai',
          context_length: 256000,
          description: 'coding with vision'
        },
        {
          id: 'qwen/qwen3-coder-480b-a35b-instruct',
          name: 'Qwen3 Coder',
          owned_by: 'qwen'
        },
        {
          id: 'black-forest-labs/flux.1-dev',
          name: 'Flux Dev',
          description: 'image generation'
        }
      ]
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  };

  try {
    const result = await fetchNvidiaCodingModels({ apiKey: 'nvidia-secret' });

    assert.equal(result.baseUrl, 'https://integrate.api.nvidia.com/v1');
    assert.equal(result.models.length, 2);
    assert.equal(result.models[0].upstreamModelId, 'moonshotai/kimi-k2.5');
    assert.equal(result.models[0].contextWindow, '256,000');
    assert.equal(result.models[0].supportsVision, true);
    assert.equal(result.models[1].upstreamModelId, 'qwen/qwen3-coder-480b-a35b-instruct');
    assert.equal(result.models[1].supportsVision, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
