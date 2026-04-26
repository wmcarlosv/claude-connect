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

function detectImageMediaTypeFromBase64(base64Data, mediaType = '') {
  if (mediaType !== 'application/octet-stream' || typeof base64Data !== 'string' || base64Data.length === 0) {
    return mediaType;
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const header = buffer.subarray(0, 16);

  if (header.length >= 8
    && header[0] === 0x89
    && header[1] === 0x50
    && header[2] === 0x4e
    && header[3] === 0x47
    && header[4] === 0x0d
    && header[5] === 0x0a
    && header[6] === 0x1a
    && header[7] === 0x0a) {
    return 'image/png';
  }

  if (header.length >= 3
    && header[0] === 0xff
    && header[1] === 0xd8
    && header[2] === 0xff) {
    return 'image/jpeg';
  }

  if (header.length >= 6
    && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a'
      || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) {
    return 'image/gif';
  }

  if (header.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return mediaType;
}

function normalizeAnthropicContentBlock(block) {
  if (!isObject(block) || block.type !== 'image' || !isObject(block.source)) {
    return block;
  }

  if (block.source.type !== 'base64' || typeof block.source.data !== 'string') {
    return block;
  }

  const mediaType = detectImageMediaTypeFromBase64(block.source.data, block.source.media_type);

  if (mediaType === block.source.media_type) {
    return block;
  }

  return {
    ...block,
    source: {
      ...block.source,
      media_type: mediaType
    }
  };
}

export function normalizeAnthropicRequestForUpstream(body) {
  if (!isObject(body)) {
    return body;
  }

  return {
    ...body,
    messages: Array.isArray(body.messages)
      ? body.messages.map((message) => ({
          ...message,
          content: Array.isArray(message?.content)
            ? message.content.map((block) => normalizeAnthropicContentBlock(block))
            : message?.content
        }))
      : body.messages
  };
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
    let mediaType = typeof source.media_type === 'string' ? source.media_type : '';

    if (source.type === 'base64' && typeof source.data === 'string' && mediaType.length > 0) {
      mediaType = detectImageMediaTypeFromBase64(source.data, mediaType);

      return {
        type: 'image_url',
        image_url: {
          url: `data:${mediaType};base64,${source.data}`
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
  if (isObject(value)) {
    return value;
  }

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

function extractEncodedToolCalls(text) {
  if (typeof text !== 'string' || !text.includes('<|tool_call_begin|>')) {
    return {
      text,
      toolCalls: []
    };
  }

  const toolCalls = [];
  let cleanedText = text
    .replace(/<\|tool_calls_section_begin\|>/g, '')
    .replace(/<\|tool_calls_section_end\|>/g, '');
  const toolCallPattern = /<\|tool_call_begin\|>(.*?)<\|tool_call_argument_begin\|>(.*?)<\|tool_call_end\|>/gs;

  cleanedText = cleanedText.replace(toolCallPattern, (_match, rawName, rawArguments) => {
    const encodedName = String(rawName ?? '').trim();
    const name = encodedName
      .replace(/^functions\./, '')
      .replace(/:\d+$/, '')
      .trim();
    const input = safeParseJson(String(rawArguments ?? '').trim());

    if (name.length > 0) {
      toolCalls.push({
        id: encodedName || `toolu_${crypto.randomUUID().replace(/-/g, '')}`,
        name,
        input
      });
    }

    return '';
  });

  return {
    text: cleanedText.trim(),
    toolCalls
  };
}

const TOOL_PATH_FIELD_PATTERN = /(?:^|_)(?:path|file|filename|filepath|dir|directory|target|source)(?:$|_)/i;

function normalizeToolPathValue(value) {
  if (typeof value !== 'string' || value.length < 2) {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return value;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if ((first === '\'' && last === '\'') || (first === '"' && last === '"')) {
    return trimmed.slice(1, -1);
  }

  const hasLeadingQuote = first === '\'' || first === '"';
  const hasTrailingQuote = last === '\'' || last === '"';

  if (hasTrailingQuote && !hasLeadingQuote && !trimmed.slice(0, -1).includes(last)) {
    return trimmed.slice(0, -1);
  }

  if (hasLeadingQuote && !hasTrailingQuote && !trimmed.slice(1).includes(first)) {
    return trimmed.slice(1);
  }

  return value;
}

function normalizeToolInput(value, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeToolInput(item, key));
  }

  if (!isObject(value)) {
    return TOOL_PATH_FIELD_PATTERN.test(key) ? normalizeToolPathValue(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      normalizeToolInput(entryValue, entryKey)
    ])
  );
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

function normalizeTerminalMarkdownText(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  return value
    .replace(/\$\\(?:rightarrow|to)\$/g, '->')
    .replace(/\$\\(?:leftarrow)\$/g, '<-')
    .replace(/\$\\(?:leftrightarrow)\$/g, '<->')
    .replace(/\$\\(?:Rightarrow|implies)\$/g, '=>')
    .replace(/\$\\(?:Leftarrow)\$/g, '<=')
    .replace(/\$\\(?:Leftrightarrow|iff)\$/g, '<=>')
    .replace(/\\(?:rightarrow|to)\b/g, '->')
    .replace(/\\leftarrow\b/g, '<-')
    .replace(/\\leftrightarrow\b/g, '<->')
    .replace(/\\(?:Rightarrow|implies)\b/g, '=>')
    .replace(/\\Leftarrow\b/g, '<=')
    .replace(/\\(?:Leftrightarrow|iff)\b/g, '<=>');
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

function usesMaxCompletionTokens(model) {
  return typeof model === 'string' && /^gpt-5(?:[.-]|$)/.test(model);
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
    if (usesMaxCompletionTokens(model)) {
      request.max_completion_tokens = body.max_tokens;
    } else {
      request.max_tokens = body.max_tokens;
    }
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

export function buildOllamaRequestFromAnthropic({ body, model }) {
  const messages = [];
  const toolUseIdToName = new Map();
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
      let textParts = [];
      let imageParts = [];

      const flushUserMessage = () => {
        if (textParts.length === 0 && imageParts.length === 0) {
          return;
        }

        messages.push({
          role: 'user',
          content: textParts.join('\n\n'),
          ...(imageParts.length > 0 ? { images: imageParts } : {})
        });

        textParts = [];
        imageParts = [];
      };

      for (const block of blocks) {
        if (block?.type === 'tool_result') {
          flushUserMessage();
          messages.push({
            role: 'tool',
            tool_name: toolUseIdToName.get(block.tool_use_id) ?? block.tool_use_id ?? 'tool',
            content: collectText(block.content)
          });
          continue;
        }

        if (block?.type === 'image' && block?.source?.type === 'base64' && typeof block?.source?.data === 'string') {
          imageParts.push(block.source.data);
          continue;
        }

        textParts.push(collectText(block?.text ?? block));
      }

      flushUserMessage();
      continue;
    }

    if (message?.role === 'assistant') {
      const textParts = [];
      const toolCalls = [];

      for (const block of blocks) {
        if (block?.type === 'tool_use') {
          toolUseIdToName.set(block.id, block.name);
          toolCalls.push({
            function: {
              name: block.name,
              arguments: block.input ?? {}
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
    request.options = {
      ...(isObject(request.options) ? request.options : {}),
      num_predict: body.max_tokens
    };
  }

  if (typeof body.temperature === 'number') {
    request.options = {
      ...(isObject(request.options) ? request.options : {}),
      temperature: body.temperature
    };
  }

  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length > 0) {
    request.options = {
      ...(isObject(request.options) ? request.options : {}),
      stop: body.stop_sequences
    };
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

  return request;
}

export function buildAnthropicMessageFromOpenAI({ response, requestedModel }) {
  const choice = response?.choices?.[0] ?? {};
  const assistantMessage = choice?.message ?? {};
  const content = [];
  const rawText = typeof assistantMessage.content === 'string'
    ? assistantMessage.content
    : Array.isArray(assistantMessage.content)
      ? assistantMessage.content
          .map((item) => collectText(item))
          .join('\n')
      : '';
  const parsedEncodedTools = extractEncodedToolCalls(rawText);
  const text = parsedEncodedTools.text;

  if (text.length > 0) {
    content.push({
      type: 'text',
      text: normalizeTerminalMarkdownText(text)
    });
  }

  for (const toolCall of parsedEncodedTools.toolCalls) {
    content.push({
      type: 'tool_use',
      id: toolCall.id || `toolu_${crypto.randomUUID().replace(/-/g, '')}`,
      name: toolCall.name || 'tool',
      input: normalizeToolInput(toolCall.input)
    });
  }

  for (const toolCall of Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : []) {
    content.push({
      type: 'tool_use',
      id: toolCall.id || `toolu_${crypto.randomUUID().replace(/-/g, '')}`,
      name: toolCall.function?.name || 'tool',
      input: normalizeToolInput(safeParseJson(toolCall.function?.arguments))
    });
  }

  const stopReason = content.some((block) => block.type === 'tool_use')
    ? 'tool_use'
    : mapStopReason(choice?.finish_reason);

  return {
    id: typeof response?.id === 'string'
      ? response.id
      : `msg_${crypto.randomUUID().replace(/-/g, '')}`,
    type: 'message',
    role: 'assistant',
    model: requestedModel || response?.model || 'unknown',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: Number(response?.usage?.prompt_tokens ?? 0),
      output_tokens: Number(response?.usage?.completion_tokens ?? 0)
    }
  };
}

export function buildAnthropicMessageFromOllama({ response, requestedModel }) {
  const assistantMessage = isObject(response?.message) ? response.message : {};
  const content = [];
  const text = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
  const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];

  if (text.length > 0) {
    content.push({
      type: 'text',
      text: normalizeTerminalMarkdownText(text)
    });
  }

  for (const toolCall of toolCalls) {
    content.push({
      type: 'tool_use',
      id: `toolu_${crypto.randomUUID().replace(/-/g, '')}`,
      name: toolCall?.function?.name || 'tool',
      input: safeParseJson(toolCall?.function?.arguments)
    });
  }

  return {
    id: `msg_${crypto.randomUUID().replace(/-/g, '')}`,
    type: 'message',
    role: 'assistant',
    model: requestedModel || response?.model || 'unknown',
    content,
    stop_reason: toolCalls.length > 0
      ? 'tool_use'
      : response?.done_reason === 'length'
        ? 'max_tokens'
        : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: Number(response?.prompt_eval_count ?? 0),
      output_tokens: Number(response?.eval_count ?? 0)
    }
  };
}

function writeSseEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function writeAnthropicStreamStart(response, message) {
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
}

export function writeAnthropicStreamContent(response, message) {
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

export function writeAnthropicStreamFromMessage(response, message) {
  writeAnthropicStreamStart(response, message);
  writeAnthropicStreamContent(response, message);
}
