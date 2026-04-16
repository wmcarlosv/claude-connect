import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOpenRouterFreeModels, isFreeOpenRouterModel } from '../src/lib/openrouter.js';

test('isFreeOpenRouterModel accepts free variants and zero-priced entries', () => {
  assert.equal(isFreeOpenRouterModel({ id: 'openrouter/free' }), true);
  assert.equal(isFreeOpenRouterModel({ id: 'qwen/qwen-3:free' }), true);
  assert.equal(isFreeOpenRouterModel({ id: 'vendor/model-x', name: 'Model X Free' }), true);
  assert.equal(isFreeOpenRouterModel({
    id: 'vendor/model-y',
    pricing: {
      prompt: '0',
      completion: '0'
    }
  }), true);
  assert.equal(isFreeOpenRouterModel({
    id: 'openai/gpt-5.4',
    pricing: {
      prompt: '0.000002',
      completion: '0.00001'
    }
  }), false);
});

test('fetchOpenRouterFreeModels keeps router and filters only free entries from /models', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          id: 'openrouter/free',
          name: 'OpenRouter Free Router',
          context_length: 200000
        },
        {
          id: 'qwen/qwen-3:free',
          name: 'Qwen 3 Free',
          context_length: 128000
        },
        {
          id: 'google/gemini-flash',
          name: 'Gemini Flash',
          pricing: {
            prompt: '0.000001',
            completion: '0.000005'
          }
        }
      ]
    })
  });

  try {
    const result = await fetchOpenRouterFreeModels();

    assert.equal(result.baseUrl, 'https://openrouter.ai/api/v1');
    assert.equal(result.models.length, 2);
    assert.equal(result.models[0].upstreamModelId, 'openrouter/free');
    assert.equal(result.models[1].upstreamModelId, 'qwen/qwen-3:free');
    assert.equal(result.models[1].isFreeTier, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
