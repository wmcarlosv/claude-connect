import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchNvidiaCodingModels,
  isNvidiaCodingModel,
  isNvidiaDownloadableModel,
  isNvidiaSupportedModel
} from '../src/lib/nvidia.js';

test('isNvidiaCodingModel accepts coding-oriented model metadata', () => {
  assert.equal(isNvidiaCodingModel({ id: 'qwen/qwen3-coder-480b-a35b-instruct' }), true);
  assert.equal(isNvidiaCodingModel({ id: 'moonshotai/kimi-k2.5', description: 'coding agent' }), true);
  assert.equal(isNvidiaCodingModel({ id: 'google/gemma-4-31b-it' }), true);
  assert.equal(isNvidiaCodingModel({ id: 'black-forest-labs/flux.1-dev', description: 'image generation' }), false);
});

test('isNvidiaDownloadableModel accepts Downloadable metadata', () => {
  assert.equal(isNvidiaDownloadableModel({ id: 'google/gemma-4-31b-it', badges: ['Downloadable'] }), true);
  assert.equal(isNvidiaDownloadableModel({ id: 'google/gemma-4-31b-it', downloadAvailable: true }), true);
  assert.equal(isNvidiaDownloadableModel({ id: 'nvidia/riva-translate-1.6b', api_catalog_type: 'Downloadable' }), true);
  assert.equal(isNvidiaSupportedModel({ id: 'nvidia/riva-translate-1.6b', api_catalog_type: 'Downloadable' }), true);
});

test('fetchNvidiaCodingModels maps coding and Downloadable models from /models', async () => {
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
          id: 'google/gemma-4-31b-it',
          name: 'Gemma 4 31B IT',
          owned_by: 'google',
          badges: ['Downloadable'],
          description: 'frontier reasoning and agentic workflows'
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
    assert.equal(result.models.length, 3);
    assert.equal(result.models[0].upstreamModelId, 'google/gemma-4-31b-it');
    assert.equal(result.models[0].category, 'NVIDIA NIM Downloadable');
    assert.match(result.models[0].summary, /downloadable/);
    assert.equal(result.models[0].supportsVision, true);
    assert.equal(result.models[1].upstreamModelId, 'moonshotai/kimi-k2.5');
    assert.equal(result.models[1].contextWindow, '256,000');
    assert.equal(result.models[1].supportsVision, true);
    assert.equal(result.models[2].upstreamModelId, 'qwen/qwen3-coder-480b-a35b-instruct');
    assert.equal(result.models[2].supportsVision, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
