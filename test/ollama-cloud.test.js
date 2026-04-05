import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOllamaCloudModels, isOllamaCloudModelId } from '../src/lib/ollama-cloud.js';

test('isOllamaCloudModelId detects documented cloud suffixes', () => {
  assert.equal(isOllamaCloudModelId('glm-4.7:cloud'), true);
  assert.equal(isOllamaCloudModelId('qwen3-coder:480b-cloud'), true);
  assert.equal(isOllamaCloudModelId('qwen3-coder'), false);
});

test('fetchOllamaCloudModels maps cloud models from ollama.com/api/tags', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      models: [
        {
          name: 'glm-4.7:cloud',
          model: 'glm-4.7:cloud',
          details: {
            family: 'glm',
            parameter_size: 'Auto'
          }
        },
        {
          name: 'qwen3-coder',
          model: 'qwen3-coder',
          details: {
            family: 'qwen3-coder',
            parameter_size: '30B'
          }
        }
      ]
    })
  });

  try {
    const result = await fetchOllamaCloudModels({ apiKey: 'ollama-secret' });

    assert.equal(result.baseUrl, 'https://ollama.com');
    assert.equal(result.models.length, 1);
    assert.equal(result.models[0].id, 'glm-4.7:cloud');
    assert.equal(result.models[0].apiBaseUrl, 'https://ollama.com');
    assert.equal(result.models[0].apiPath, '/api/chat');
    assert.equal(result.models[0].transportMode, 'gateway');
    assert.equal(result.models[0].apiStyle, 'ollama-chat');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('fetchOllamaCloudModels falls back to all returned models when cloud suffixes are absent', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      models: [
        {
          name: 'glm-5',
          model: 'glm-5',
          details: {
            family: 'glm'
          }
        },
        {
          name: 'qwen3-coder-next',
          model: 'qwen3-coder-next',
          details: {
            family: 'qwen3-coder'
          }
        }
      ]
    })
  });

  try {
    const result = await fetchOllamaCloudModels({ apiKey: 'ollama-secret' });

    assert.equal(result.models.length, 2);
    assert.equal(result.models[0].id, 'glm-5');
    assert.equal(result.models[1].id, 'qwen3-coder-next');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
