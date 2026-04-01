import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnthropicMessageFromOpenAI,
  buildOpenAIRequestFromAnthropic,
  estimateTokenCountFromAnthropicRequest
} from '../src/gateway/messages.js';

test('buildOpenAIRequestFromAnthropic maps text and tools to chat completions', () => {
  const request = buildOpenAIRequestFromAnthropic({
    model: 'qwen3-coder-plus',
    body: {
      system: 'Eres un asistente de codigo.',
      max_tokens: 2048,
      temperature: 0.1,
      tool_choice: {
        type: 'tool',
        name: 'read_file'
      },
      tools: [
        {
          name: 'read_file',
          description: 'Lee un archivo',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string'
              }
            },
            required: ['path']
          }
        }
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Abre src/index.js'
            }
          ]
        }
      ]
    }
  });

  assert.equal(request.model, 'qwen3-coder-plus');
  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages[1].role, 'user');
  assert.equal(request.tools[0].function.name, 'read_file');
  assert.deepEqual(request.tool_choice, {
    type: 'function',
    function: {
      name: 'read_file'
    }
  });
});

test('buildOpenAIRequestFromAnthropic maps assistant tool_use and user tool_result', () => {
  const request = buildOpenAIRequestFromAnthropic({
    model: 'qwen3-coder-plus',
    body: {
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'read_file',
              input: {
                path: 'src/index.js'
              }
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: 'contenido'
            }
          ]
        }
      ]
    }
  });

  assert.equal(request.messages[0].role, 'assistant');
  assert.equal(request.messages[0].tool_calls[0].function.name, 'read_file');
  assert.equal(request.messages[1].role, 'tool');
  assert.equal(request.messages[1].tool_call_id, 'toolu_1');
});

test('buildOpenAIRequestFromAnthropic maps anthropic image blocks to openai image_url parts', () => {
  const request = buildOpenAIRequestFromAnthropic({
    model: 'big-pickle',
    body: {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Lee esta imagen'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'aGVsbG8='
              }
            }
          ]
        }
      ]
    }
  });

  assert.equal(request.messages[0].role, 'user');
  assert.ok(Array.isArray(request.messages[0].content));
  assert.deepEqual(request.messages[0].content[0], {
    type: 'text',
    text: 'Lee esta imagen'
  });
  assert.deepEqual(request.messages[0].content[1], {
    type: 'image_url',
    image_url: {
      url: 'data:image/png;base64,aGVsbG8='
    }
  });
});

test('buildOpenAIRequestFromAnthropic normalizes octet-stream images to detected png mime', () => {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRr0AAAAASUVORK5CYII=';
  const request = buildOpenAIRequestFromAnthropic({
    model: 'kimi-for-coding',
    body: {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'application/octet-stream',
                data: pngBase64
              }
            }
          ]
        }
      ]
    }
  });

  assert.deepEqual(request.messages[0].content[0], {
    type: 'image_url',
    image_url: {
      url: `data:image/png;base64,${pngBase64}`
    }
  });
});

test('buildAnthropicMessageFromOpenAI maps tool calls back to anthropic blocks', () => {
  const message = buildAnthropicMessageFromOpenAI({
    requestedModel: 'qwen3-coder-plus',
    response: {
      id: 'chatcmpl_123',
      model: 'qwen3-coder-plus',
      usage: {
        prompt_tokens: 111,
        completion_tokens: 22
      },
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: 'Voy a revisar el archivo.',
            tool_calls: [
              {
                id: 'call_1',
                function: {
                  name: 'read_file',
                  arguments: '{"path":"src/index.js"}'
                }
              }
            ]
          }
        }
      ]
    }
  });

  assert.equal(message.role, 'assistant');
  assert.equal(message.stop_reason, 'tool_use');
  assert.equal(message.content[0].type, 'text');
  assert.equal(message.content[1].type, 'tool_use');
  assert.deepEqual(message.content[1].input, {
    path: 'src/index.js'
  });
});

test('estimateTokenCountFromAnthropicRequest returns a positive approximation', () => {
  const tokenCount = estimateTokenCountFromAnthropicRequest({
    system: 'Sistema',
    messages: [
      {
        role: 'user',
        content: 'Hola mundo'
      }
    ]
  });

  assert.equal(typeof tokenCount, 'number');
  assert.ok(tokenCount >= 1);
});
