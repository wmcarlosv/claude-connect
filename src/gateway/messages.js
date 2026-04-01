import crypto from 'node:crypto';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectText(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (isObject(item) && item.type === 'text' && typeof item.text === 'string') {
          return item.text;
        }

        return JSON.stringify(item);
      })
      .join('\n');
  }

  if (isObject(value) && value.type === 'text' && typeof value.text === 'string') {
    return value.text;
  }

  if (value == null) {
    return '';
  }

  return JSON.stringify(value);
}

function normalizeBlocks(content) {
  if (Array.isArray(content)) {
    return content;
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (content == null) {
    return [];
  }

  return [content];
}

function buildOpenAIContentPartFromAnthropicBlock(block) {
  if (typeof block === 'string') {
    return {
      type: 'text',
      text: block
    };
  }

  if (!isObject(block)) {
    return {
      type: 'text',
      text: collectText(block)
    };
  }

  if (block.type === 'text') {
    return {
      type: 'text',
      text: typeof block.text === 'string' ? block.text : collectText(block.text)
    };
  }

  if (block.type === 'image') {
    const source = isObject(block.source) ? block.source : {};

    if (source.type === 'base64' && typeof source.data === 'string' && typeof source.media_type === 'string') {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${source.media_type};base64,${source.data}`
        }
      };
    }

    if (typeof source.url === 'string' && source.url.length > 0) {
      return {
        type: 'image_url',
        image_url: {
          url: source.url
        }
      };
    }

    throw new Error('El gateway recibio una imagen en un formato no soportado por el adaptador OpenAI.');
  }

  return {
    type: 'text',
    text: collectText(block)
  };
}

function safeParseJson(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return {
      raw: value
    };
  }
}

function mapStopReason(finishReason) {
  switch (finishReason) {
    case 'tool_calls':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'stop':
    case 'function_call':
      return 'end_turn';
    default:
      return null;
  }
}

export function estimateTokenCountFromAnthropicRequest(body) {
  const systemText = collectText(body.system);
  const messagesText = Array.isArray(body.messages)
    ? body.messages
        .map((message) => collectText(message?.content))
        .join('\n')
    : '';
  const toolsText = Array.isArray(body.tools) ? JSON.stringify(body.tools) : '';
  const totalLength = `${systemText}\n${messagesText}\n${toolsText}`.trim().length;

  return Math.max(1, Math.ceil(totalLength / 4));
}

export function buildOpenAIRequestFromAnthropic({ body, model }) {
  const messages = [];
  const systemText = collectText(body.system).trim();

  if (systemText.length > 0) {
    messages.push({
      role: 'system',
      content: systemText
    });
  }

  for (const message of Array.isArray(body.messages) ? body.messages : []) {
    const blocks = normalizeBlocks(message?.content);

    if (message?.role === 'user') {
      let contentParts = [];

      for (const block of blocks) {
        if (block?.type === 'tool_result') {
          if (contentParts.length > 0) {
            const onlyText = contentParts.every((part) => part?.type === 'text');
            messages.push({
              role: 'user',
              content: onlyText
                ? contentParts.map((part) => part.text).join('\n\n')
                : contentParts
            });
            contentParts = [];
          }

          messages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: collectText(block.content)
          });
          continue;
        }

        contentParts.push(buildOpenAIContentPartFromAnthropicBlock(block));
      }

      if (contentParts.length > 0) {
        const onlyText = contentParts.every((part) => part?.type === 'text');
        messages.push({
          role: 'user',
          content: onlyText
            ? contentParts.map((part) => part.text).join('\n\n')
            : contentParts
        });
      }

      continue;
    }

    if (message?.role === 'assistant') {
      const textParts = [];
      const toolCalls = [];

      for (const block of blocks) {
        if (block?.type === 'tool_use') {
          toolCalls.push({
            id: typeof block.id === 'string' && block.id.length > 0
              ? block.id
              : `call_${crypto.randomUUID().replace(/-/g, '')}`,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {})
            }
          });
          continue;
        }

        textParts.push(collectText(block?.text ?? block));
      }

      messages.push({
        role: 'assistant',
        content: textParts.join('\n\n'),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
      });
    }
  }

  const request = {
    model,
    messages,
    stream: false
  };

  if (typeof body.max_tokens === 'number') {
    request.max_tokens = body.max_tokens;
  }

  if (typeof body.temperature === 'number') {
    request.temperature = body.temperature;
  }

  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length > 0) {
    request.stop = body.stop_sequences;
  }

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    request.tools = body.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.input_schema ?? {
          type: 'object',
          properties: {}
        }
      }
    }));
  }

  if (isObject(body.tool_choice) && typeof body.tool_choice.type === 'string') {
    if (body.tool_choice.type === 'auto') {
      request.tool_choice = 'auto';
    } else if (body.tool_choice.type === 'any') {
      request.tool_choice = 'required';
    } else if (body.tool_choice.type === 'tool' && typeof body.tool_choice.name === 'string') {
      request.tool_choice = {
        type: 'function',
        function: {
          name: body.tool_choice.name
        }
      };
    } else if (body.tool_choice.type === 'none') {
      request.tool_choice = 'none';
    }
  }

  return request;
}

export function buildAnthropicMessageFromOpenAI({ response, requestedModel }) {
  const choice = response?.choices?.[0] ?? {};
  const assistantMessage = choice?.message ?? {};
  const content = [];
  const text = typeof assistantMessage.content === 'string'
    ? assistantMessage.content
    : Array.isArray(assistantMessage.content)
      ? assistantMessage.content
          .map((item) => collectText(item))
          .join('\n')
      : '';

  if (text.length > 0) {
    content.push({
      type: 'text',
      text
    });
  }

  for (const toolCall of Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : []) {
    content.push({
      type: 'tool_use',
      id: toolCall.id || `toolu_${crypto.randomUUID().replace(/-/g, '')}`,
      name: toolCall.function?.name || 'tool',
      input: safeParseJson(toolCall.function?.arguments)
    });
  }

  return {
    id: typeof response?.id === 'string'
      ? response.id
      : `msg_${crypto.randomUUID().replace(/-/g, '')}`,
    type: 'message',
    role: 'assistant',
    model: requestedModel || response?.model || 'unknown',
    content,
    stop_reason: mapStopReason(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: Number(response?.usage?.prompt_tokens ?? 0),
      output_tokens: Number(response?.usage?.completion_tokens ?? 0)
    }
  };
}

function writeSseEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function writeAnthropicStreamFromMessage(response, message) {
  writeSseEvent(response, 'message_start', {
    type: 'message_start',
    message: {
      ...message,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: 0
      }
    }
  });

  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      writeSseEvent(response, 'content_block_start', {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'text',
          text: ''
        }
      });

      if (typeof block.text === 'string' && block.text.length > 0) {
        writeSseEvent(response, 'content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: {
            type: 'text_delta',
            text: block.text
          }
        });
      }

      writeSseEvent(response, 'content_block_stop', {
        type: 'content_block_stop',
        index
      });
      return;
    }

    if (block.type === 'tool_use') {
      writeSseEvent(response, 'content_block_start', {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: {}
        }
      });

      writeSseEvent(response, 'content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(block.input ?? {})
        }
      });

      writeSseEvent(response, 'content_block_stop', {
        type: 'content_block_stop',
        index
      });
    }
  });

  writeSseEvent(response, 'message_delta', {
    type: 'message_delta',
    delta: {
      stop_reason: message.stop_reason,
      stop_sequence: message.stop_sequence
    },
    usage: {
      output_tokens: message.usage.output_tokens
    }
  });

  writeSseEvent(response, 'message_stop', {
    type: 'message_stop'
  });
}
