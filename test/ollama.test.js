import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchOllamaModels, normalizeOllamaBaseUrl } from '../src/lib/ollama.js';
import {
  buildAnthropicMessageFromOllama,
  buildOllamaRequestFromAnthropic
} from '../src/gateway/messages.js';

test('normalizeOllamaBaseUrl adds http protocol when omitted', () => {
  assert.equal(normalizeOllamaBaseUrl('127.0.0.1:11434'), 'http://127.0.0.1:11434');
});

test('fetchOllamaModels maps /api/tags models to gateway-ready entries', async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      models: [
        {
          name: 'qwen2.5-coder:7b',
          model: 'qwen2.5-coder:7b',
          details: {
            family: 'qwen2.5-coder',
            parameter_size: '7B',
            quantization_level: 'Q4_K_M'
          }
        }
      ]
    })
  });

  try {
    const result = await fetchOllamaModels({ baseUrl: 'http://127.0.0.1:11434' });

    assert.equal(result.baseUrl, 'http://127.0.0.1:11434');
    assert.equal(result.models.length, 1);
    assert.equal(result.models[0].id, 'qwen2.5-coder:7b');
    assert.equal(result.models[0].apiBaseUrl, 'http://127.0.0.1:11434');
    assert.equal(result.models[0].apiPath, '/v1/chat/completions');
    assert.equal(result.models[0].transportMode, 'gateway');
    assert.equal(result.models[0].apiStyle, 'openai-chat');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('buildOllamaRequestFromAnthropic maps anthropic messages to native /api/chat payload', () => {
  const request = buildOllamaRequestFromAnthropic({
    model: 'llama2:latest',
    body: {
      system: 'Eres un asistente.',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: 'Hola'
        }
      ]
    }
  });

  assert.equal(request.model, 'llama2:latest');
  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages[1].role, 'user');
  assert.equal(request.options.num_predict, 128);
});

test('buildAnthropicMessageFromOllama maps native response back to anthropic format', () => {
  const message = buildAnthropicMessageFromOllama({
    requestedModel: 'llama2:latest',
    response: {
      model: 'llama2:latest',
      done_reason: 'stop',
      prompt_eval_count: 12,
      eval_count: 9,
      message: {
        role: 'assistant',
        content: 'OLLAMA_OK'
      }
    }
  });

  assert.equal(message.model, 'llama2:latest');
  assert.equal(message.content[0].text, 'OLLAMA_OK');
  assert.equal(message.usage.input_tokens, 12);
  assert.equal(message.usage.output_tokens, 9);
});
