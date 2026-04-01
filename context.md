# Claude Connect Context

## Objetivo

`claude-connect` es un CLI en Node.js para conectar `Claude Code` con proveedores externos de modelos y poder cambiar entre ellos sin perder la configuración original de Claude.

## Estado actual

La app hoy ya soporta:

- interfaz interactiva de consola
- catálogo local en SQLite
- proveedor `OpenCode Go`
- proveedor `Zen`
- proveedor `Kimi`
- proveedor `DeepSeek`
- proveedor `Qwen`
- autenticación por `Token`
- autenticación por `OAuth` para `Qwen`
- perfiles locales reutilizables
- edición y eliminación de conexiones guardadas
- guardado local opcional de API keys compartidas por proveedor
- gateway local Anthropic-compatible
- activación reversible sobre la instalación real de `Claude Code`
- snapshot y restauración de:
  - `settings.json`
  - `~/.claude.json`
  - `.credentials.json`
- detección automática de rutas en Linux y Windows
- navegación con `Volver` y confirmación de salida con doble `Esc`

## Proveedores activos

### OpenCode Go

- provider id: `opencode-go`
- auth: `token`
- base URL del proveedor: `https://opencode.ai/zen/go`
- variable sugerida: `OPENCODE_API_KEY`
- integración: mixta

Modelos OpenCode Go soportados hoy:

- directos por `messages`:
  - `minimax-m2.7`
  - `minimax-m2.5`
- OpenAI-compatible vía gateway:
  - `glm-5`
  - `kimi-k2.5`

Fuente oficial:

- https://opencode.ai/docs/es/go/

### Zen

- provider id: `zen`
- auth: `token`
- base URL del proveedor: `https://opencode.ai/zen`
- variable sugerida: `OPENCODE_API_KEY`
- integración: mixta

Modelos Zen soportados hoy:

- Anthropic directos:
  - `claude-opus-4-6`
  - `claude-opus-4-5`
  - `claude-opus-4-1`
  - `claude-sonnet-4-6`
  - `claude-sonnet-4-5`
  - `claude-sonnet-4`
  - `claude-haiku-4-5`
  - `claude-3-5-haiku`
- OpenAI-compatible vía gateway:
  - `minimax-m2.5`
  - `minimax-m2.5-free`
  - `glm-5`
  - `kimi-k2.5`
  - `big-pickle`
  - `mimo-v2-pro-free`
  - `mimo-v2-omni-free`
  - `qwen3.6-plus-free`
  - `nemotron-3-super-free`

Nota:

- esta primera integración de `Zen` no incluye todavía los modelos expuestos por `responses`
- tampoco incluye todavía los modelos de endpoint tipo Google

### Kimi

- provider id: `kimi`
- modelo: `kimi-for-coding`
- auth: `token`
- base URL: `https://api.kimi.com/coding/`
- integración: directa sobre Claude Code

### DeepSeek

- provider id: `deepseek`
- modelos:
  - `deepseek-chat`
  - `deepseek-reasoner`
- auth: `token`
- base URL del proveedor: `https://api.deepseek.com`
- base URL usada por Claude Code: `https://api.deepseek.com/anthropic`
- integración: directa sobre Claude Code

### Qwen

- provider id: `qwen`
- modelo: `qwen3-coder-plus`
- auth:
  - `token`
  - `oauth`
- base URL modo token: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- base URL OAuth upstream real: `https://portal.qwen.ai/v1`
- integración: a través de gateway local Anthropic-compatible

## Flujo principal actual

1. `Nueva conexion`
2. seleccionar proveedor
3. seleccionar modelo
4. seleccionar tipo de conexión
5. guardar API key una sola vez por proveedor si aplica
6. guardar perfil local
7. `Activar en Claude`
8. abrir `claude`

Si el perfil activado es:

- `OpenCode Go` con modelo `messages`: Claude usa endpoint directo de Go
- `OpenCode Go` con modelo `chat/completions`: Claude usa el gateway local
- `Zen` con modelo Anthropic: Claude usa endpoint directo de Zen
- `Zen` con modelo `chat/completions`: Claude usa el gateway local
- `Kimi`: Claude usa endpoint directo de Kimi
- `DeepSeek`: Claude usa endpoint directo Anthropic-compatible de DeepSeek
- `Qwen`: Claude usa el gateway local en `127.0.0.1:4310`

También existen estas opciones en el menú:

- `Gestionar conexiones`
- `Estado Claude`
- `Estado gateway`
- `Detener gateway`
- `Revertir Claude`
- `Ver catalogo`

## Catálogo

Archivo principal:

- `src/data/catalog-store.js`

Detalles:

- el catálogo se siembra desde código
- la base local se genera automáticamente en `storage/claude-connect.sqlite`
- la base SQLite ya no se versiona en git
- esto evita conflictos de `git pull` por cambios locales del catálogo
- la tabla `models` ya guarda metadatos de transporte por modelo

El catálogo guarda:

- proveedores
- modelos
- métodos de autenticación
- configuración OAuth por proveedor
- `base_url` por proveedor
- modo de transporte del modelo
- estilo de API del modelo
- base URL y path upstream por modelo

## Perfiles y secretos

Archivo principal:

- `src/lib/profile.js`

Secretos:

- `src/lib/secrets.js`

Los perfiles guardan:

- proveedor
- modelo
- método de autenticación
- endpoint base
- metadata de transporte del modelo

Los secretos viven fuera del repo, dentro del directorio local de Claude Connect.

Por defecto:

- Linux: `~/.claude-connect`
- Windows: `%APPDATA%\claude-connect`

Ahí se guardan:

- perfiles
- tokens OAuth
- API keys administradas por proveedor
- estado del switch
- estado y logs del gateway

## OAuth de Qwen

Archivo principal:

- `src/lib/oauth.js`

El flujo implementado es el device flow oficial de `Qwen Code`.

Endpoints usados:

- device code: `https://chat.qwen.ai/api/v1/oauth2/device/code`
- token: `https://chat.qwen.ai/api/v1/oauth2/token`
- URL mostrada al usuario:
  - `https://chat.qwen.ai/auth?...`
  - o `https://chat.qwen.ai/authorize?...`

Comportamiento actual:

- intenta abrir el navegador por defecto
- también muestra la URL en consola para copiar y pegar manualmente
- en Windows se corrigió la apertura para no truncar parámetros ni abrir el explorador de archivos
- si la autorización expira o falla, el error ahora se muestra con mejor detalle

## Switch reversible de Claude Code

Archivo principal:

- `src/lib/claude-settings.js`

La app hoy:

- detecta automáticamente la instalación real de Claude
- escribe la configuración activa del proveedor elegido
- guarda snapshots del estado original
- limpia de forma reversible credenciales de `claude.ai` cuando hace falta
- decide si el perfil debe ir directo o por gateway según los metadatos del modelo
- restaura todo con `Revertir Claude`

Archivos afectados:

- `settings.json`
- `~/.claude.json`
- `.credentials.json`

Esto fue necesario especialmente para `Kimi` y modelos directos con `ANTHROPIC_API_KEY`, porque Claude Code seguía detectando `claude.ai` aunque `settings.json` ya tuviera otra credencial activa.

## Gateway local

Archivos principales:

- `src/gateway/server.js`
- `src/gateway/messages.js`
- `src/gateway/state.js`
- `src/gateway/constants.js`

Se usa hoy para:

- `OpenCode Go` en sus modelos `chat/completions`
- `Qwen`
- `Zen` en sus modelos `chat/completions`

Endpoint local:

- `http://127.0.0.1:4310/anthropic`

Responsabilidades:

- exponer interfaz Anthropic-compatible a Claude Code
- resolver el perfil activo
- leer token OAuth o API key según el perfil
- traducir requests Anthropic a OpenAI-compatible
- reenviar al upstream correcto según el modelo
- soportar `stream` y endpoints básicos de mensajes

Limitación actual:

- el gateway solo soporta hoy upstream tipo `openai-chat`
- aún no convierte a `responses` ni a endpoints tipo Google

## Compatibilidad Linux y Windows

Archivo principal:

- `src/lib/app-paths.js`

La app detecta automáticamente:

- ruta de `settings.json`
- ruta de `~/.claude.json`
- ruta de `.credentials.json`
- directorio local de Claude Connect
- rutas de perfiles, tokens y gateway

Se corrigieron además:

- `npm start` para Windows
- apertura del navegador en OAuth de Qwen en Windows
- reutilización del gateway si el puerto ya estaba ocupado por una instancia sana

## Navegación de la UI

Archivos principales:

- `src/wizard.js`
- `src/lib/terminal.js`

Comportamiento actual:

- opción visible `Volver` en listas
- `Tab` para volver cuando aplica
- `Esc` una vez avisa
- `Esc` dos veces sale
- tras crear o editar una conexión, la app vuelve al menú principal

## Estado de documentación y repo

Estado actual del repo:

- la base SQLite local ya no se versiona
- el catálogo compartido vive como seeds en código
- las credenciales de usuario no se suben al repo
- el paquete ya fue preparado para npm y publicado
