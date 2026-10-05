# Agentes de Xpenses

Configuración adaptada de Long Dog Chaos el 2026-10-01 para Angular y Firebase.
Los perfiles viven en `agents/*.toml` y se registran en [config.toml](config.toml).

## Equipo y modelos

| Perfil | Responsabilidad | Modelo / esfuerzo |
| --- | --- | --- |
| [tech_lead](agents/tech_lead.toml) | Tareas, delegación, contratos e integración | gpt-6.1-sol / high |
| [product_designer](agents/product_designer.toml) | Flujos, reglas y criterios de aceptación | gpt-6.1-sol / high |
| [frontend_engineer](agents/frontend_engineer.toml) | Lógica Angular, formularios y cálculos | gpt-6.1-sol / high |
| [firebase_engineer](agents/firebase_engineer.toml) | Datos, AngularFire, autenticación y reglas | gpt-6.1-sol / high |
| [ui_engineer](agents/ui_engineer.toml) | Presentación, responsive y accesibilidad | gpt-6.1-sol / high |
| [qa_reviewer](agents/qa_reviewer.toml) | Revisión independiente, solo lectura | gpt-6-luna / medium |

El modelo general es `gpt-6-luna` con esfuerzo `medium`; cada perfil fija su override.
Estos valores reflejan los TOML actuales del proyecto de origen. Los roles específicos
de videojuegos y Blender se adaptaron a necesidades de Xpenses.
Se heredan permisos del cliente, salvo la restricción de solo lectura de QA.
No se modifican ajustes globales ni servidores MCP.

## Contexto y flujo

Leer [instrucciones compartidas](../AGENTS.md), [README](../README.md), [guía técnica del proyecto](../docs/project-guidelines.md) y
[arquitectura](../.github/.architecture.md). Contrastar documentos con implementación:
pueden contener descripciones históricas. Consultar .ai si se añade en el futuro.

`AGENTS.md` reúne las reglas operativas; `docs/project-guidelines.md` es la fuente
canónica de convenciones, contratos y reglas de negocio. Actualizar esa guía cuando
cambie el comportamiento. El archivo de Copilot se conserva como copia de
compatibilidad y no es una lectura requerida para Codex.

1. El Tech Lead define resultado, criterios, dependencias y archivos de cada tarea.
2. Delega áreas independientes en los especialistas apropiados.
3. Cada archivo tiene un único escritor y los contratos compartidos se acuerdan antes.
4. Los especialistas entregan cambios y evidencia; QA revisa según riesgo.
5. El Tech Lead integra y actualiza la documentación existente.

La delegación se aplica a solicitudes de desarrollo del propietario. No lanzar todos
los agentes por defecto ni crear chats separados. Preservar cambios locales ajenos.
Los perfiles no autorizan commits, despliegues ni migraciones de datos.
Desarrollo y producción pueden compartir Firebase: usar emuladores/datos sintéticos
y comprobar destino antes de probar escrituras.

## Uso

En una nueva sesión de Xpenses, pedir por ejemplo:

> Usa tech_lead para desarrollar esta funcionalidad. Divide el trabajo y delega en frontend_engineer, firebase_engineer o ui_engineer según corresponda.

> Delega en qa_reviewer la revisión de estos cambios; no implementes correcciones.

Crear estos archivos no inicia agentes. La sesión debe cargar los perfiles; si no están
disponibles, abrir una nueva sesión del proyecto y comprobar la configuración del cliente.
Los cambios no modifican el modelo de turnos que ya estén activos.

## Validación

Para cambios de código, usar `npm run build` y pruebas pertinentes según `package.json`.
Existe `npm test` (Angular/Karma); no existe `npm run check`.
Para cambios solo de configuración, validar sintaxis TOML, nombres y rutas de perfiles.
La validación de archivos no prueba la carga efectiva de agentes ni disponibilidad de modelos.

Formato contrastado con [OpenAI Docs: subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents).
