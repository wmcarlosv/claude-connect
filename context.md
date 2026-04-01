# Claude Connect Context

## Objetivo

`claude-connect` es un CLI en Node.js para conectar `Claude Code` con proveedores externos de modelos. La primera integración activa es `Qwen`.

La app busca:

- crear conexiones locales por proveedor
- soportar `OAuth` y `Token` cuando el proveedor lo permita
- guardar perfiles reutilizables
- conmutar `Claude Code` hacia un gateway local compatible con Anthropic
- poder revertir la configuración original de Claude en cualquier momento

## Estado actual

Hoy la app ya soporta:

- interfaz interactiva de consola
- catálogo en SQLite
- proveedor `Kimi`
- proveedor `DeepSeek`
- proveedor `Qwen`
- modelo `Kimi For Coding` (`kimi-for-coding`)
- modelos `deepseek-chat` y `deepseek-reasoner`
- modelo `Qwen Coder` (`qwen3-coder-plus`)
- autenticación por `Token`
- autenticación por `OAuth` con device flow de `Qwen Code`
- edición y eliminación de conexiones guardadas
- almacenamiento local opcional de API keys para perfiles por token
- guardado de perfiles y tokens localmente
- activación reversible sobre la configuración real de `Claude Code`
- limpieza reversible de las credenciales reales de `claude.ai` al activar `Kimi`
- gateway local `Anthropic-compatible`
- soporte de descubrimiento de rutas para Linux y Windows
- catalogo SQLite generado localmente desde seeds sin versionar la base de datos binaria

## Flujo principal actual

El flujo de usuario hoy es:

1. `Nueva conexion`
2. seleccionar proveedor
3. seleccionar tipo de conexión: `OAuth` o `Token`
4. guardar perfil local
5. `Activar en Claude`
6. si es `Qwen`, arrancar gateway local
7. si es `Kimi`, preparar launcher aislado
8. usar `Claude Code` con el modo correspondiente

También existe:

- `Estado Claude`
- `Estado gateway`
- `Detener gateway`
- `Gestionar conexiones`
- `Revertir Claude`
- comando `claude-kimi`

## Arquitectura

### 1. Catálogo

Archivo principal:

- `src/data/catalog-store.js`

Se usa SQLite para guardar:

- proveedores
- modelos
- métodos de autenticación
- configuración OAuth por proveedor

El repo comparte las seeds del catalogo en codigo, pero no comparte perfiles, tokens, API keys ni la base SQLite generada de cada usuario.

Actualmente el catálogo siembra dos proveedores:

- `Kimi`
- `DeepSeek`
- `Qwen`

Con:

- Kimi:
  - `base_url`: `https://api.kimi.com/coding/`
  - modelo: `kimi-for-coding`
  - auth: `token`
- DeepSeek:
  - `base_url`: `https://api.deepseek.com`
  - modelos: `deepseek-chat`, `deepseek-reasoner`
  - auth: `token`
- `base_url` para modo token: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- modelo fijo: `qwen3-coder-plus`
- auth methods: `token`, `oauth`

## 2. Perfiles

Archivo principal:

- `src/lib/profile.js`

Los perfiles guardan:

- proveedor
- modelo
- método de auth
- endpoint base
- datos auxiliares de integración

Los perfiles no guardan la API key. En modo token solo se guarda el nombre de la variable de entorno.

Si el usuario decide guardar una API key administrada por la app, esa informacion vive fuera del repo, dentro del directorio local de `Claude Connect`.

## 3. OAuth de Qwen

Archivo principal:

- `src/lib/oauth.js`

El flujo OAuth implementado es el `device flow` de `Qwen Code`, no el de Alibaba Cloud.

Endpoints usados:

- device code: `https://chat.qwen.ai/api/v1/oauth2/device/code`
- token: `https://chat.qwen.ai/api/v1/oauth2/token`
- URL de autorización mostrada al usuario: `https://chat.qwen.ai/auth?...` o `https://chat.qwen.ai/authorize?...`

El token se guarda localmente con:

- `access_token`
- `refresh_token`
- `expires_in`
- `expiresAt`
- `savedAt`

También quedó soporte para refrescar el token si el gateway recibe un `401`.

## 4. Switch reversible de Claude Code

Archivo principal:

- `src/lib/claude-settings.js`

La app:

- detecta el `settings.json` real de Claude
- preserva una copia lógica del estado original
- escribe la nueva configuración para usar el gateway local
- permite revertir al estado anterior
- evita tocar el Claude global cuando el proveedor usa runtime aislado

Variables de entorno que inyecta al activar un perfil:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
- `CLAUDE_CONNECT_ACTIVE_PROFILE`
- `CLAUDE_CONNECT_PROVIDER`
- `CLAUDE_CONNECT_MODEL`
- `CLAUDE_CONNECT_AUTH_METHOD`
- `CLAUDE_CONNECT_TOKEN_ENV_VAR` o `CLAUDE_CONNECT_TOKEN_FILE`

## 5. Gateway local

Archivos principales:

- `src/gateway/server.js`
- `src/gateway/messages.js`
- `src/gateway/state.js`
- `src/gateway/constants.js`

El gateway escucha en:

- `http://127.0.0.1:4310/anthropic`

Endpoints implementados:

- `GET /anthropic/health`
- `GET /anthropic/v1/models`
- `POST /anthropic/v1/messages`
- `POST /anthropic/v1/messages/count_tokens`

Responsabilidades:

- resolver el perfil activo
- obtener credenciales según `token` u `oauth`
- traducir requests Anthropic a OpenAI-compatible
- reenviar a Qwen
- traducir responses OpenAI-compatible a formato Anthropic
- soportar respuesta normal y `stream: true` por SSE

## 6. Upstream real de Qwen OAuth

Durante la implementación se verificó con una petición real que el upstream válido para OAuth es:

- `https://portal.qwen.ai/v1`

No funcionó:

- `https://api.qwen.ai/v1`

Para perfiles OAuth nuevos se guarda `apiBaseUrl = https://portal.qwen.ai/v1`.

Para perfiles viejos, el gateway también infiere la base usando `resource_url` del token.

## 6.1 Kimi

Kimi quedó integrado por `API key` únicamente.

Base URL configurada:

- `https://api.kimi.com/coding/`
- activacion directa en Claude Code: `https://api.kimi.com/coding/`

Modelo expuesto:

- `kimi-for-coding`

Según la documentación oficial vigente, Kimi Code para Claude Code usa:

- `ANTHROPIC_BASE_URL=https://api.kimi.com/coding/`
- `ANTHROPIC_API_KEY=<token>`
- `ENABLE_TOOL_SEARCH=false`

Para evitar el conflicto entre una sesión normal de `claude.ai` y `Kimi`, el proyecto ahora crea un runtime separado en `~/.claude-connect/runtimes/...` y lo lanza con `claude-kimi` o `claude-connect launch-profile <perfil>`.

## 6.2 DeepSeek

DeepSeek quedó integrado por `API key` únicamente.

Base URL configurada:

- `https://api.deepseek.com`
- activacion directa en Claude Code: `https://api.deepseek.com/anthropic`

Modelos expuestos:

- `deepseek-chat`
- `deepseek-reasoner`

Según la documentación oficial vigente, DeepSeek expone compatibilidad Anthropic para Claude Code, con `stream` y `tools` soportados.

## 7. Compatibilidad Linux y Windows

Archivo principal:

- `src/lib/app-paths.js`

La app ya no depende de rutas fijas repartidas por el código.

Ahora detecta automáticamente:

- ruta de configuración de Claude
- directorio base de Claude Connect
- rutas de perfiles, tokens, estado del switch y logs del gateway

Overrides soportados:

- `CLAUDE_SETTINGS_PATH`
- `CLAUDE_CONFIG_DIR`
- `CLAUDE_CODE_CONFIG_DIR`

Tambien se corrigio el punto de entrada del paquete para Windows: los binarios publicados ahora son scripts Node y no wrappers bash, lo que hace que `npm link`, `claude-connect` y `claude-kimi` sean portables en Linux y Windows.
- `CLAUDE_CONNECT_HOME`

Defaults contemplados:

- Linux: `~/.claude/settings.json`, XDG y `~/.claude-connect`
- Windows: `%APPDATA%\\Claude\\settings.json`, `%LOCALAPPDATA%\\Claude\\settings.json` y `%APPDATA%\\claude-connect`

Además, el apagado del gateway en Windows usa `taskkill`.

## Verificaciones realizadas

Se verificó:

- tests unitarios pasando con `npm test`
- arranque real del gateway
- endpoint `health`
- request real `POST /anthropic/v1/messages`
- respuesta real correcta desde Qwen OAuth
- streaming SSE correcto para `stream: true`

## Archivos clave

- `src/index.js`
- `src/wizard.js`
- `src/data/catalog-store.js`
- `src/lib/app-paths.js`
- `src/lib/profile.js`
- `src/lib/oauth.js`
- `src/lib/claude-settings.js`
- `src/gateway/server.js`
- `src/gateway/messages.js`
- `src/gateway/state.js`
- `test/app-paths.test.js`
- `test/gateway-messages.test.js`

## Decisiones importantes tomadas

- usar SQLite desde el inicio para catálogo de proveedores
- versionar en git solo la base SQLite del catálogo
- no versionar perfiles, tokens, API keys ni estado local de usuarios
- empezar solo con `Qwen`
- restringir Qwen a `Qwen Coder`
- usar el OAuth real de `Qwen Code`
- usar un gateway local en vez de conectar Claude directamente a OpenAI-compatible
- mantener reversible el switch de Claude
- dar compatibilidad a perfiles viejos con `auth.method = api_key`
- centralizar descubrimiento de rutas para Linux y Windows

## Próximos pasos naturales

- validar el flujo completo en una máquina Windows real
- añadir más proveedores al catálogo SQLite
- mejorar la traducción de herramientas si aparecen diferencias con Claude Code real
- añadir manejo más fino de expiración/refresh de OAuth
- incorporar comandos no interactivos para crear y activar conexiones más rápido
