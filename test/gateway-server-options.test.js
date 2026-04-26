import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClaudeConnectRequestGuidance,
  applyProviderAnthropicRequestOptions,
  applyProviderOpenAIRequestOptions,
  buildGatewayTraceEvent,
  extractUpstreamErrorMessage,
  streamAnthropicMessageWithKeepAlive
} from '../src/gateway/server.js';

function profile(providerId, modelId) {
  return {
    provider: {
      id: providerId,
      name: providerId
    },
    model: {
      id: modelId,
      upstreamModelId: modelId,
      name: modelId
    }
  };
}

test('applyClaudeConnectRequestGuidance prepends agent compatibility rules once', () => {
  const first = applyClaudeConnectRequestGuidance({
    system: 'Sistema original',
    messages: []
  });
  const second = applyClaudeConnectRequestGuidance(first);

  assert.match(first.system, /Claude Connect compatibility rules:/);
  assert.match(first.system, /Sistema original/);
  assert.equal(second.system, first.system);
});

test('applyProviderOpenAIRequestOptions enables OpenAI reasoning effort for GPT-5 models', () => {
  const request = applyProviderOpenAIRequestOptions({
    model: 'gpt-5.4',
    messages: [
      {
        role: 'user',
        content: 'hola'
      }
    ]
  }, profile('openai', 'gpt-5.4'));

  assert.equal(request.reasoning_effort, 'high');
});

test('applyProviderOpenAIRequestOptions enables NVIDIA chat template thinking for reasoning candidates', () => {
  const request = applyProviderOpenAIRequestOptions({
    model: 'google/gemma-4-31b-it',
    messages: [
      {
        role: 'user',
        content: 'hola'
      }
    ]
  }, profile('nvidia', 'google/gemma-4-31b-it'));

  assert.equal(request.chat_template_kwargs.thinking, true);
});

test('applyProviderOpenAIRequestOptions enables Gemini reasoning effort by model family', () => {
  const proRequest = applyProviderOpenAIRequestOptions({
    model: 'gemini-3-pro-preview',
    messages: [
      {
        role: 'user',
        content: 'hola'
      }
    ]
  }, profile('gemini', 'gemini-3-pro-preview'));
  const flashRequest = applyProviderOpenAIRequestOptions({
    model: 'gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: 'hola'
      }
    ]
  }, profile('gemini', 'gemini-2.5-flash'));
  const liteRequest = applyProviderOpenAIRequestOptions({
    model: 'gemini-2.5-flash-lite-preview-09-2025',
    messages: [
      {
        role: 'user',
        content: 'hola'
      }
    ]
  }, profile('gemini', 'gemini-2.5-flash-lite-preview-09-2025'));

  assert.equal(proRequest.reasoning_effort, 'high');
  assert.equal(flashRequest.reasoning_effort, 'medium');
  assert.equal(liteRequest.reasoning_effort, 'low');
});

test('applyProviderAnthropicRequestOptions enables thinking for current DeepSeek reasoning-capable models', () => {
  const flashRequest = applyProviderAnthropicRequestOptions({
    max_tokens: 4096,
    messages: []
  }, profile('deepseek', 'deepseek-v4-flash'));
  const proRequest = applyProviderAnthropicRequestOptions({
    max_tokens: 4096,
    messages: []
  }, profile('deepseek', 'deepseek-v4-pro'));
  const legacyReasonerRequest = applyProviderAnthropicRequestOptions({
    max_tokens: 4096,
    messages: []
  }, profile('deepseek', 'deepseek-reasoner'));

  const chatRequest = applyProviderAnthropicRequestOptions({
    max_tokens: 4096,
    messages: []
  }, profile('deepseek', 'deepseek-chat'));

  assert.deepEqual(flashRequest.thinking, {
    type: 'enabled',
    budget_tokens: 2048
  });
  assert.deepEqual(proRequest.output_config, {
    effort: 'max'
  });
  assert.deepEqual(legacyReasonerRequest.output_config, {
    effort: 'high'
  });
  assert.equal(chatRequest.thinking, undefined);
});

test('buildGatewayTraceEvent summarizes requests without prompt content', () => {
  const event = buildGatewayTraceEvent({
    traceId: 'req_test',
    phase: 'end',
    context: {
      profile: profile('cloudflare-workers-ai', '@cf/moonshotai/kimi-k2.6'),
      upstreamApiStyle: 'openai-chat'
    },
    body: {
      stream: true,
      system: 'secret system text',
      tools: [
        {
          name: 'read_file'
        }
      ],
      messages: [
        {
          role: 'user',
          content: 'secret prompt text'
        }
      ]
    },
    message: {
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          name: 'read_file',
          input: {
            path: 'package.json'
          }
        }
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 2
      }
    },
    startedAt: Date.now()
  });

  assert.equal(event.traceId, 'req_test');
  assert.equal(event.provider, 'cloudflare-workers-ai');
  assert.equal(event.model, '@cf/moonshotai/kimi-k2.6');
  assert.equal(event.stream, true);
  assert.equal(event.messages, 1);
  assert.equal(event.tools, 1);
  assert.equal(event.toolUses, 1);
  assert.equal(event.stopReason, 'tool_use');
  assert.doesNotMatch(JSON.stringify(event), /secret prompt text/);
  assert.doesNotMatch(JSON.stringify(event), /secret system text/);
});

test('extractUpstreamErrorMessage reads Cloudflare errors arrays', () => {
  assert.equal(extractUpstreamErrorMessage({
    errors: [
      {
        code: 10000,
        message: 'rate limit exceeded'
      }
    ]
  }, 429), 'rate limit exceeded');

  assert.equal(extractUpstreamErrorMessage({}, 429), 'HTTP 429');
});

test('extractUpstreamErrorMessage reads NVIDIA NIM error variants', () => {
  assert.equal(extractUpstreamErrorMessage({
    error: {
      detail: 'rate limit exceeded for this NVIDIA NIM model'
    }
  }, 429), 'rate limit exceeded for this NVIDIA NIM model');

  assert.equal(extractUpstreamErrorMessage({
    details: [
      {
        description: 'input token limit exceeded'
      }
    ]
  }, 400), 'input token limit exceeded');
});

test('streamAnthropicMessageWithKeepAlive can write ping before delayed message', async () => {
  const chunks = [];
  let statusCode = null;
  let headers = null;
  let ended = false;
  const response = {
    destroyed: false,
    writableEnded: false,
    writeHead(code, nextHeaders) {
      statusCode = code;
      headers = nextHeaders;
    },
    write(chunk) {
      chunks.push(String(chunk));
    },
    end() {
      ended = true;
      this.writableEnded = true;
    }
  };
  let resolveMessage;
  const messagePromise = new Promise((resolve) => {
    resolveMessage = resolve;
  });
  const streaming = streamAnthropicMessageWithKeepAlive(response, messagePromise);

  assert.equal(statusCode, 200);
  assert.equal(headers['content-type'], 'text/event-stream; charset=utf-8');
  assert.match(chunks.join(''), /event: ping/);
  assert.doesNotMatch(chunks.join(''), /event: message_start/);

  resolveMessage({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'test',
    content: [
      {
        type: 'text',
        text: 'ok'
      }
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 1,
      output_tokens: 1
    }
  });

  await streaming;

  const body = chunks.join('');
  assert.match(body, /event: message_start/);
  assert.match(body, /event: message_stop/);
  assert.equal(ended, true);
});

test('streamAnthropicMessageWithKeepAlive starts message immediately when context is provided', async () => {
  const chunks = [];
  const response = {
    destroyed: false,
    writableEnded: false,
    writeHead() {},
    write(chunk) {
      chunks.push(String(chunk));
    },
    end() {
      this.writableEnded = true;
    }
  };
  let resolveMessage;
  const messagePromise = new Promise((resolve) => {
    resolveMessage = resolve;
  });
  const streaming = streamAnthropicMessageWithKeepAlive(response, messagePromise, {
    profile: profile('cloudflare-workers-ai', '@cf/qwen/qwen2.5-coder-32b-instruct')
  });

  assert.match(chunks.join(''), /event: message_start/);
  assert.doesNotMatch(chunks.join(''), /event: content_block_start/);

  resolveMessage({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: '@cf/qwen/qwen2.5-coder-32b-instruct',
    content: [
      {
        type: 'text',
        text: 'ok'
      }
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 1,
      output_tokens: 1
    }
  });

  await streaming;

  const body = chunks.join('');
  assert.match(body, /event: content_block_start/);
  assert.match(body, /event: message_stop/);
});
