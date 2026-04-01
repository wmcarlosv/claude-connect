# Claude Connect Context

## Objetivo

`claude-connect` es un CLI en Node.js para conectar `Claude Code` con proveedores externos de modelos y poder cambiar entre ellos sin perder la configuración original de Claude.

## Estado actual

La app hoy ya soporta:

- interfaz interactiva de consola
- catálogo local en SQLite
- proveedor `Kimi`
- proveedor `DeepSeek`
- proveedor `Qwen`
- autenticación por `Token`
- autenticación por `OAuth` para `Qwen`
- perfiles locales reutilizables
- edición y eliminación de conexiones guardadas
- guardado local opcional de API keys para perfiles por token
- gateway local Anthropic-compatible para `Qwen`
- activación reversible sobre la instalación real de `Claude Code`
- snapshot y restauración de:
  - `settings.json`
  - `~/.claude.json`
  - `.credentials.json`
- detección automática de rutas en Linux y Windows
- navegación con `Volver` y confirmación de salida con doble `Esc`

## Proveedores activos

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
5. guardar perfil local
6. `Activar en Claude`
7. abrir `claude`

Si el perfil activado es:

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

El catálogo guarda:

- proveedores
- modelos
- métodos de autenticación
- configuración OAuth por proveedor
- `base_url` por proveedor

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
- metadata del perfil

Los secretos viven fuera del repo, dentro del directorio local de Claude Connect.

Por defecto:

- Linux: `~/.claude-connect`
- Windows: `%APPDATA%\claude-connect`

Ahí se guardan:

- perfiles
- tokens OAuth
- API keys administradas por la app
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
- restaura todo con `Revertir Claude`

Archivos afectados:

- `settings.json`
- `~/.claude.json`
- `.credentials.json`

Esto fue necesario especialmente para `Kimi`, porque Claude Code seguía detectando `claude.ai` aunque `settings.json` ya tuviera `ANTHROPIC_API_KEY`.

## Gateway local

Archivos principales:

- `src/gateway/server.js`
- `src/gateway/messages.js`
- `src/gateway/state.js`
- `src/gateway/constants.js`

Se usa para `Qwen`.

Endpoint local:

- `http://127.0.0.1:4310/anthropic`

Responsabilidades:

- exponer interfaz Anthropic-compatible a Claude Code
- resolver el perfil activo
- leer token OAuth o API key según el perfil
- traducir requests/responses entre formatos
- soportar `stream` y endpoints básicos de mensajes

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
- los cambios del fix de credenciales de Claude y del no-track de SQLite ya fueron publicados en `master`
