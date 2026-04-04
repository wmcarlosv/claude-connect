# Claude Connect

> Conecta `Claude Code` con `OpenCode Go`, `Zen`, `Kimi`, `DeepSeek`, `Z.AI`, `Ollama`, `OpenAI`, `Inception Labs`, `OpenRouter` y `Qwen` desde una interfaz de consola clara, rápida y reversible.

[![npm version](https://img.shields.io/npm/v/claude-connect?style=for-the-badge&logo=npm&color=cb3837)](https://www.npmjs.com/package/claude-connect)
[![node](https://img.shields.io/badge/node-%3E%3D22-2f7d32?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-0f172a?style=for-the-badge)](./LICENSE)
[![providers](https://img.shields.io/badge/providers-OpenCode%20Go%20%7C%20Zen%20%7C%20Kimi%20%7C%20DeepSeek%20%7C%20Z.AI%20%7C%20Ollama%20%7C%20OpenAI%20%7C%20Inception%20Labs%20%7C%20OpenRouter%20%7C%20Qwen-0ea5e9?style=for-the-badge)](https://www.npmjs.com/package/claude-connect)

<p align="center">
  <img src="./ezgif-871b2bc9267494c5.gif" alt="Claude Connect demo" width="980" />
</p>

## Why Claude Connect

`Claude Connect` te permite cambiar `Claude Code` hacia otros proveedores sin editar archivos a mano, sin perder tu configuración original y sin convertir tu terminal en un caos de variables de entorno.

### Highlights

- `OpenCode Go`, `Zen`, `Kimi`, `DeepSeek`, `Z.AI`, `Ollama`, `OpenAI`, `Inception Labs`, `OpenRouter` y `Qwen` listos desde el primer arranque
- soporte para `Token` y `OAuth` cuando el proveedor lo permite
- API keys compartidas por proveedor para no repetir el mismo token en cada modelo
- activación reversible sobre la instalación real de `Claude Code`
- limpieza automática del conflicto entre `claude.ai` y `ANTHROPIC_API_KEY`
- gateway local Anthropic-compatible para `Qwen`
- detección automática de rutas en Linux y Windows
- catálogo local en SQLite generado automáticamente
- interfaz de consola con navegación simple y profesional

## Package

- npm: https://www.npmjs.com/package/claude-connect
- repo: https://github.com/wmcarlosv/claude-connect

## Install

Instalación global:

```bash
npm install -g claude-connect
claude-connect
```

Instalación simple en proyecto:

```bash
npm i claude-connect
```

Ejecución con `npx`:

```bash
npx claude-connect
```

Desarrollo local:

```bash
npm start
```

Requisito:

- `Node.js 22` o superior

## Quick Flow

```text
Nueva conexion
  -> proveedor
  -> modelo
  -> OAuth o Token
  -> guardar API key una vez por proveedor si aplica
  -> guardar perfil
  -> Activar en Claude
  -> usar claude
```

Al activar:

- `OpenCode Go` usa conexión directa o gateway según el modelo elegido
- `Zen` usa conexión directa o gateway según el modelo elegido
- `Kimi` usa gateway local y reenvia al endpoint Anthropic de `https://api.kimi.com/coding/`
- `DeepSeek` apunta a `https://api.deepseek.com/anthropic`
- `Z.AI` apunta a `https://api.z.ai/api/anthropic`
- `Ollama` pide una URL local o remota, valida `/api/tags` y usa el gateway local sobre `.../api/chat`
- `OpenAI` usa el gateway local sobre `https://api.openai.com/v1/chat/completions`
- `Inception Labs` usa el gateway local sobre `https://api.inceptionlabs.ai/v1/chat/completions`
- `OpenRouter` usa `openrouter/free` por gateway sobre `https://openrouter.ai/api/v1`
- `Qwen` apunta al gateway local `http://127.0.0.1:4310/anthropic`
- para algunos modelos con limites conocidos, el gateway ahora ajusta `max_tokens` y bloquea prompts sobredimensionados antes de que el upstream devuelva errores opacos
- para `Inception Labs`, el gateway tambien respeta un presupuesto local de input tokens por minuto para reducir errores de `Rate limit reached`

## Providers

| Proveedor | Modelos | Auth | Integración |
| --- | --- | --- | --- |
| `OpenCode Go` | `glm-5`, `kimi-k2.5`, `minimax-m2.7`, `minimax-m2.5` | `Token` | Mixta |
| `Zen` | `Claude*` de Zen + modelos `chat/completions` de Zen | `Token` | Mixta |
| `Kimi` | `kimi-for-coding` | `Token` | Gateway local |
| `DeepSeek` | `deepseek-chat`, `deepseek-reasoner` | `Token` | Directa |
| `Z.AI` | `glm-5.1`, `glm-4.7`, `glm-4.5-air` | `Token` | Directa |
| `Ollama` | modelos descubiertos desde tu servidor | `Servidor Ollama` | Gateway local |
| `OpenAI` | `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.2`, `gpt-5.1-codex-max`, `gpt-5.1-codex-mini` | `Token` | Gateway local |
| `Inception Labs` | `mercury-2` | `Token` | Gateway local |
| `OpenRouter` | `openrouter/free` | `Token` | Gateway local |
| `Qwen` | `qwen3-coder-plus` | `OAuth`, `Token` | Gateway local |

Nota sobre `OpenCode Go`:

- `minimax-m2.7` y `minimax-m2.5` van directos por endpoint `messages`
- `glm-5` y `kimi-k2.5` van por gateway usando `chat/completions`

Nota sobre `Zen`:

- los modelos Anthropic de Zen van por conexión directa
- los modelos de Zen servidos por `chat/completions` van por gateway local
- esta primera integración no incluye todavía los modelos de Zen expuestos por `responses` ni los de endpoint tipo Google

Nota sobre `OpenAI`:

- esta integración usa `Chat Completions` por `gateway local`
- el bridge actual encaja bien con los modelos GPT/Codex listados porque Claude Code sigue hablando Anthropic hacia `claude-connect`
- la autenticación soportada hoy es `API key`; no se expone `OAuth` para este proveedor
- `gpt-5.4` quedó validado con una llamada real a través del gateway local
- referencia oficial:
  - https://platform.openai.com/docs/api-reference/chat/create
  - https://platform.openai.com/docs/api-reference/authentication
  - https://developers.openai.com/api/docs/models

Nota sobre `Inception Labs`:

- esta primera integracion expone solo `mercury-2`, que es el modelo chat-compatible oficial en `v1/chat/completions`
- `mercury-2` se trata como modelo solo texto en Claude Connect; si envias una imagen, la app ahora corta la peticion con un mensaje claro
- Claude Connect aplica presupuesto preventivo de contexto para `mercury-2` usando ventana `128K` y salida maxima `16,384`
- Claude Connect tambien aplica una ventana deslizante local de `400,000` input tokens por minuto para reducir rechazos del upstream por rate limit
- `Mercury Edit 2` no se publica todavia en Claude Connect porque usa endpoints `fim/edit` que no encajan con Claude Code en esta arquitectura
- autenticacion soportada: `API key`
- referencias oficiales:
  - https://docs.inceptionlabs.ai/get-started/get-started
  - https://docs.inceptionlabs.ai/get-started/authentication
  - https://docs.inceptionlabs.ai/get-started/models
  - https://docs.inceptionlabs.ai/get-started/rate-limits

Nota sobre `DeepSeek`:

- Claude Connect aplica presupuesto preventivo de contexto para `deepseek-chat` y `deepseek-reasoner`
- referencias oficiales:
  - https://api-docs.deepseek.com/quick_start/pricing/
  - https://api-docs.deepseek.com/guides/reasoning_model

Nota sobre `Z.AI`:

- usa el endpoint Anthropic-compatible oficial `https://api.z.ai/api/anthropic`
- Claude Connect fija `API_TIMEOUT_MS=3000000`
- al activar un perfil de `Z.AI`, tambien mapea `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL` y `ANTHROPIC_DEFAULT_OPUS_MODEL` al modelo elegido para que Claude Code use `GLM` de forma consistente
- referencias oficiales:
  - https://docs.z.ai/devpack/tool/claude

Nota sobre `Ollama`:

- la URL del servidor se define al crear la conexión
- sirve tanto para `localhost` como para un VPS o servidor remoto con Ollama expuesto
- Claude Connect consulta `/api/tags` para listar modelos y validar la conexión antes de guardar
- luego usa el endpoint nativo `POST /api/chat`, que resultó más compatible para servidores remotos que publican mal `/v1/*`
- servidores remotos pueden seguir fallando por timeout, auth cloud o respuestas pobres del modelo; la app ya distingue mejor esos casos
- referencia oficial:
  - https://docs.ollama.com/openai
  - https://docs.ollama.com/api/tags

## What It Stores

Claude Connect guarda el estado sensible fuera del repo.

Rutas por defecto:

```text
Linux: ~/.claude-connect
Windows: %APPDATA%\claude-connect
```

Ahí viven:

- perfiles
- tokens OAuth
- API keys compartidas por proveedor
- estado del switch de Claude
- logs y estado del gateway

El catálogo SQLite local se genera automáticamente en:

```text
Linux: ~/.claude-connect/storage/claude-connect.sqlite
Windows: %APPDATA%\claude-connect\storage\claude-connect.sqlite
```

Importante:

- esa base ya no se versiona en git
- el catálogo se siembra desde `src/data/catalog-store.js`
- ya no se crea en la carpeta donde ejecutas el comando
- esto evita conflictos molestos al hacer `git pull` y carpetas `storage/` accidentales en proyectos ajenos

## Claude Code Switching

Cuando activas un perfil, la app modifica la configuración real detectada de `Claude Code` y guarda un snapshot reversible.

Archivos implicados:

- `settings.json`
- `~/.claude.json`
- `.credentials.json`

Eso permite:

- activar otro proveedor sin tocar archivos manualmente
- evitar el `Auth conflict` entre sesión `claude.ai` y `API key`
- volver a tu estado original con `Revertir Claude`
- bloquear la activación si `Claude Code` no está realmente instalado todavía

## Qwen OAuth

`Qwen` usa el device flow oficial de `Qwen Code`.

URL típica de autorización:

```text
https://chat.qwen.ai/auth?user_code=XXXXX&client=qwen-code
```

Comportamiento actual:

- intenta abrir el navegador por defecto
- también deja la URL visible para copiar y pegar manualmente
- en Windows ya se corrigió la apertura del navegador

## Console UX

- `Volver` aparece como opción visible en listas
- `Tab` vuelve a la pantalla anterior cuando aplica
- `Esc` una vez avisa
- `Esc` dos veces sale
- después de crear o editar una conexión, regresas al menú principal

## Development

Pruebas:

```bash
npm test
```

Puntos principales del código:

- entrada principal: `src/wizard.js`
- catálogo: `src/data/catalog-store.js`
- switch de Claude: `src/lib/claude-settings.js`
- OAuth de Qwen: `src/lib/oauth.js`
- gateway local: `src/gateway/server.js`

## Publish Notes

El paquete npm publica solo lo necesario:

- `bin/claude-connect.js`
- `src/`
- `README.md`
- `LICENSE`

El tarball ya está preparado para distribución limpia.
