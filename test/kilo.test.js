import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchKiloFreeModels, isFreeKiloModel } from '../src/lib/kilo.js';

test('isFreeKiloModel accepts suffix and zero-priced free models', () => {
  assert.equal(isFreeKiloModel({ id: 'z-ai/glm-5:free' }), true);
  assert.equal(isFreeKiloModel({ id: 'giga-potato' }), true);
  assert.equal(isFreeKiloModel({ id: 'mystery-model', free: true }), true);
  assert.equal(isFreeKiloModel({ id: 'vendor/model-x', name: 'Model X Free Tier' }), true);
  assert.equal(isFreeKiloModel({
    id: 'giga-potato',
    pricing: {
      prompt: '0',
      completion: '0'
    }
  }), true);
  assert.equal(isFreeKiloModel({
    id: 'openai/gpt-5.2',
    pricing: {
      prompt: '0.000003',
      completion: '0.000015'
    }
  }), false);
});

test('fetchKiloFreeModels maps only free models from /models', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          id: 'z-ai/glm-5:free',
          object: 'model',
          owned_by: 'z-ai',
          name: 'GLM-5 Free',
          context_length: 128000,
          pricing: {
            prompt: '0',
            completion: '0'
          }
        },
        {
          id: 'giga-potato',
          object: 'model',
          owned_by: 'community',
          name: 'Giga Potato',
          context_length: 64000
        },
        {
          id: 'openai/gpt-5.2',
          object: 'model',
          owned_by: 'openai',
          name: 'GPT-5.2',
          context_length: 400000,
          pricing: {
            prompt: '0.000003',
            completion: '0.000015'
          }
        }
      ]
    })
  });

  try {
    const result = await fetchKiloFreeModels();

    assert.equal(result.baseUrl, 'https://api.kilo.ai/api/gateway');
    assert.equal(result.models.length, 2);
    assert.equal(result.models[0].id, 'z-ai/glm-5:free');
    assert.equal(result.models[1].id, 'giga-potato');
    assert.equal(result.models[0].apiBaseUrl, 'https://api.kilo.ai/api/gateway');
    assert.equal(result.models[0].apiPath, '/chat/completions');
    assert.equal(result.models[0].transportMode, 'gateway');
    assert.equal(result.models[0].apiStyle, 'openai-chat');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
