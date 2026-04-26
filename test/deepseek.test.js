import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDeepSeekModels } from '../src/lib/deepseek.js';

test('fetchDeepSeekModels maps current DeepSeek /models entries', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/models');
    assert.equal(options.headers.accept, 'application/json');

    return new Response(JSON.stringify({
      data: [
        {
          id: 'deepseek-v4-pro',
          object: 'model',
          owned_by: 'deepseek'
        },
        {
          id: 'deepseek-v4-flash',
          object: 'model',
          owned_by: 'deepseek'
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
    const result = await fetchDeepSeekModels();

    assert.equal(result.baseUrl, 'https://api.deepseek.com');
    assert.equal(result.anthropicBaseUrl, 'https://api.deepseek.com/anthropic');
    assert.equal(result.models.length, 2);
    assert.equal(result.models[0].upstreamModelId, 'deepseek-v4-flash');
    assert.equal(result.models[0].transportMode, 'direct');
    assert.equal(result.models[0].apiStyle, 'anthropic');
    assert.equal(result.models[0].supportsVision, false);
    assert.equal(result.models[1].upstreamModelId, 'deepseek-v4-pro');
    assert.equal(result.models[1].contextWindow, '1M');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
