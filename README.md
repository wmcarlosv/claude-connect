# Claude Connect

CLI en Node.js para conectar `Claude Code` con proveedores externos desde una interfaz de consola.

## Estado actual

La app ya soporta:

- `Kimi` por `API key`
- `DeepSeek` por `API key`
- `Qwen` por `OAuth` o `Token`
- catálogo local en SQLite sembrado automáticamente desde código
- creación, edición y eliminación de conexiones
- activación reversible sobre la instalación real de `Claude Code`
- detección automática de rutas en Linux y Windows
- gateway local Anthropic-compatible para `Qwen`
- limpieza y restauración reversible de credenciales de `claude.ai` para evitar `Auth conflict`
- navegación con `Volver` en pantallas y salida por doble `Esc`

## Uso

Arranque local:

```bash
npm start
```

Para exponer el comando globalmente:

```bash
npm link
claude-connect
```

## Flujo principal

1. `Nueva conexion`
2. elegir proveedor
3. elegir modelo
4. elegir tipo de conexión: `OAuth` o `Token`
5. guardar perfil local
6. `Activar en Claude`
7. usar `claude`

Al activar:

- `Kimi` usa `https://api.kimi.com/coding/`
- `DeepSeek` usa `https://api.deepseek.com/anthropic`
- `Qwen` usa el gateway local `http://127.0.0.1:4310/anthropic`

## Dónde se guarda cada cosa

Claude Connect guarda estado local fuera del repo. Por defecto:

```text
Linux: ~/.claude-connect
Windows: %APPDATA%\claude-connect
```

Ahí viven:

- perfiles
- tokens OAuth
- API keys gestionadas por la app
- estado del switch de Claude
- estado y logs del gateway

El catálogo SQLite local se genera automáticamente en:

```text
storage/claude-connect.sqlite
```

Importante:

- esa base ya no se versiona en git
- el catálogo se reconstruye desde `src/data/catalog-store.js`
- un `git pull` no debería volver a darte conflicto por la base SQLite

## Switch de Claude Code

La activación modifica la configuración real detectada de Claude Code y guarda un snapshot reversible.

Archivos implicados:

- `settings.json` de Claude
- `~/.claude.json`
- `.credentials.json` de Claude

Esto permite:

- activar `Kimi`, `DeepSeek` o `Qwen`
- evitar conflicto entre `claude.ai` y `ANTHROPIC_API_KEY`
- restaurar la sesión original con `Revertir Claude`

## Proveedores

### Kimi

- modelo: `kimi-for-coding`
- auth: `Token`
- base URL: `https://api.kimi.com/coding/`
- activación directa en Claude Code

### DeepSeek

- modelos: `deepseek-chat`, `deepseek-reasoner`
- auth: `Token`
- base URL de activación: `https://api.deepseek.com/anthropic`
- activación directa en Claude Code

### Qwen

- modelo: `qwen3-coder-plus`
- auth: `OAuth`, `Token`
- OAuth con device flow oficial de `Qwen Code`
- gateway local requerido para integrarlo con Claude Code

URL de autorización típica:

```text
https://chat.qwen.ai/auth?user_code=XXXXX&client=qwen-code
```

## Navegación

- `Tab` vuelve a la pantalla anterior cuando aplica
- `Volver` aparece como opción visible en listas
- `Esc` una vez avisa
- `Esc` dos veces sale

## Desarrollo

Pruebas:

```bash
npm test
```

Entrada principal:

- `src/wizard.js`

Catálogo:

- `src/data/catalog-store.js`

Switch de Claude:

- `src/lib/claude-settings.js`

OAuth Qwen:

- `src/lib/oauth.js`

Gateway local:

- `src/gateway/server.js`
