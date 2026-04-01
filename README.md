# Claude Connect

CLI en Node.js para configurar perfiles de conexion de Claude Code con modelos externos.

## Estado actual

Primera version con flujo interactivo para `DeepSeek` y `Qwen` usando catalogo SQLite:

- seleccion de proveedor
- seleccion de modelo segun proveedor
- seleccion de tipo de conexion `OAuth` o `Token`
- uso de `base_url` almacenada en el proveedor
- soporte para `Qwen OAuth` abriendo `qwen.ai`
- soporte para `DeepSeek` por `API key`
- activacion directa de DeepSeek sobre su endpoint Anthropic oficial, sin gateway local
- edicion y eliminacion de conexiones guardadas
- guardado local opcional de API keys para perfiles por token
- generacion de perfil local reutilizable
- descubrimiento automatico de la configuracion de Claude en Linux y Windows
- activacion reversible sobre el `settings.json` real detectado

## Uso local

```bash
npm start
```

Para exponer el comando globalmente en tu entorno local:

```bash
npm link
claude-connect
```

Los perfiles, tokens y estado interno se guardan en el directorio detectado de Claude Connect. Por defecto:

```text
Linux: ~/.claude-connect
Windows: %APPDATA%\claude-connect
```

Importante:

- el repo versiona solo el catalogo SQLite en `storage/claude-connect.sqlite`
- los perfiles, tokens OAuth, API keys y estado del gateway viven fuera del repo, en el directorio local de cada usuario
- cada persona que descargue el proyecto maneja su propia configuracion y sus propias credenciales

El catalogo SQLite se crea en:

```text
storage/claude-connect.sqlite
```

La API key no se persiste dentro del perfil. El archivo solo referencia la variable de entorno que debe existir en tu shell, por ejemplo:

```bash
export DASHSCOPE_API_KEY=<tu_api_key>
```

Si eliges `OAuth`, el CLI inicia el device flow oficial de Qwen Code, abre una URL de este estilo:

```text
https://chat.qwen.ai/auth?user_code=XXXXX&client=qwen-code
```

Luego espera la aprobacion y guarda el token dentro de la ruta detectada de Claude Connect.

## Switch de Claude Code

El menu principal ahora permite:

- activar un perfil guardado sobre Claude Code
- editar o eliminar conexiones guardadas
- ver el estado actual del switch
- revertir y restaurar tu `settings.json` original detectado automaticamente

Claude Connect preserva la configuracion original en el directorio detectado de Claude Connect, dentro de:

```text
claude-code/switch-state.json
```

Importante: Claude Code se conmuta usando `ANTHROPIC_BASE_URL`, porque ese es el mecanismo oficial para gateways compatibles con Anthropic. Para que Qwen funcione de verdad como backend de Claude Code todavia hace falta un gateway local `Anthropic-compatible`.
