import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCloudflareWorkersAiModels,
  isCloudflareTextGenerationModel,
  normalizeCloudflareAccountId
} from '../src/lib/cloudflare-workers-ai.js';

test('normalizeCloudflareAccountId validates account id format', () => {
  assert.equal(
    normalizeCloudflareAccountId('0123456789abcdef0123456789abcdef'),
    '0123456789abcdef0123456789abcdef'
  );
  assert.throws(() => normalizeCloudflareAccountId('bad'), /32 caracteres/);
});

test('isCloudflareTextGenerationModel detects Workers AI chat models', () => {
  assert.equal(isCloudflareTextGenerationModel({
    name: '@cf/openai/gpt-oss-120b',
    task: {
      name: 'Text Generation'
    },
    capabilities: ['Reasoning', 'Function calling']
  }), true);
  assert.equal(isCloudflareTextGenerationModel({
    name: '@cf/baai/bge-large-en-v1.5',
    task: {
      name: 'Text Embeddings'
    }
  }), false);
});

test('fetchCloudflareWorkersAiModels maps paginated model search results', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    assert.equal(options.headers.authorization, 'Bearer cf-secret');

    const page = new URL(url).searchParams.get('page');

    return new Response(JSON.stringify({
      success: true,
      result: page === '1'
        ? [
            {
              name: '@cf/openai/gpt-oss-120b',
              task: { name: 'Text Generation' },
              description: 'Reasoning and agentic workloads',
              capabilities: ['Reasoning', 'Function calling']
            }
          ]
        : [
            {
              name: '@cf/baai/bge-large-en-v1.5',
              task: { name: 'Text Embeddings' }
            },
            {
              name: '@cf/moonshotai/kimi-k2.5',
              task: { name: 'Text Generation' },
              description: 'Function calling, reasoning and vision'
            }
          ],
      result_info: {
        total_pages: 2
      }
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  };

  const result = await fetchCloudflareWorkersAiModels({
    accountId: '0123456789abcdef0123456789abcdef',
    apiKey: 'cf-secret'
  });

  assert.equal(calls.length, 2);
  assert.equal(result.baseUrl, 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1');
  assert.equal(result.models.length, 2);
  assert.equal(result.models[0].upstreamModelId, '@cf/openai/gpt-oss-120b');
  assert.equal(result.models[0].apiStyle, 'openai-chat');
  assert.equal(result.models[0].apiPath, '/chat/completions');
  assert.equal(result.models[1].supportsVision, true);
});
