# Nube Console — sistema de interfaz

La aplicación conserva su arquitectura HTML/CSS/JavaScript y el servidor Python. Su tarea principal es practicar una pregunta; la segunda es consultar servicios AWS. No necesita nuevas dependencias de producción.

## Dirección visual

Referencia estructural: [navegación de Cloudscape](https://cloudscape.design/patterns/general/service-navigation/) y [colecciones de fichas](https://cloudscape.design/patterns/resource-management/view/card-view/). Nube conserva nombre y marca propios; no representa una consola oficial de AWS.

- Cabecera global: secciones Preguntas / Servicios AWS y preferencia de tema.
- Navegación lateral: certificaciones y filtros de estudio, o categorías del catálogo.
- Área de trabajo: título, búsqueda y controles, contenido y acciones, ayudas contextuales.
- Acción principal: comprobar una respuesta; avanzar a la siguiente pregunta. El naranja se concentra en esas acciones.
- Servicios: fichas comparables con definición, tres características, alcance, estado de disponibilidad y enlaces oficiales. Las certificaciones se despliegan al solicitarlas para dejar espacio a los resultados.

## Tokens compartidos

Se definen en `styles.css` y los reutiliza `services.css`.

| Grupo | Decisión |
| --- | --- |
| Estructura | Azul marino `#232F3E`, común a ambos temas |
| Acción | Naranja `#FF9900`, texto oscuro `#16191F` |
| Enlaces / foco | Azul `#0066B3` / `#0972D3`; azul claro accesible en tema oscuro |
| Superficies | Blanco y gris `#F2F3F3`; superficies azul oscuro en modo oscuro |
| Texto | Tokens para texto principal, secundario y auxiliar |
| Estado | Éxito, error, advertencia e información con texto e indicadores |
| Tipografía | DM Sans local; Manrope para la marca. Enunciado 17 px / 16 px móvil |
| Espaciado | Escala de 4, 8, 12, 16, 20, 24, 32 y 40 px |
| Radios | 4 px para controles, 8 px para contenedores, 12 px para diálogos |
| Elevación | Sombra leve de superficie y sombra de diálogo |

`theme.mjs` aplica antes de cargar CSS la preferencia guardada en `nube.theme.v1`, o la del sistema si todavía no existe. La misma preferencia sirve en ambas páginas. Los datos de estudio mantienen sus claves existentes.

## Composición adaptable

- **1440 px:** navegación lateral, pregunta principal y progreso/mapa a la derecha.
- **768 px:** navegación lateral y contenido en una columna; progreso en diálogo.
- **375–430 px:** cabecera compacta, controles de idioma completos, opciones amplias, navegación inferior y avance accesible al pulgar. Progreso y certificaciones usan diálogos nativos. El catálogo muestra una ficha por fila.
- **320 px:** verificación adicional de reflujo y uso de controles.

## Estados y accesibilidad

- Carga de preguntas con región de estado y espacio reservado; errores con reintento.
- Catálogo: carga, fallo con reintento, filtros sin resultados y vacíos con acción de recuperación.
- Selección de respuestas con estado pulsado, foco conservado al renderizar, y resultado anunciado.
- Mapa: estados actual, acertada y para repasar identificados mediante etiquetas, además del color.
- Progreso con nombre, valor y descripción accesibles.
- Diálogos nativos: foco contenido, cierre por Escape y retorno al disparador.
- Formularios con nombres, etiquetas y controles de tamaño adecuado; salto de pregunta con botón y Enter.
- Tema oscuro mediante tokens y `color-scheme`; tipografías locales; movimiento reducido respetado.
- Aviso visible cuando el navegador no permite guardar cambios.

## Revisión realizada

Revisión de las dos páginas con Web Interface Guidelines, axe-core 4.14.0 y recorridos de teclado. Sin infracciones automáticas detectadas en las vistas revisadas. Los controles con glifos decorativos requieren comprobación manual de contraste; sus colores proceden de los tokens revisados. Esto no constituye una certificación formal de WCAG ni una revisión del contenido de todas las preguntas.

Pares principales de texto sobre fondos: mínimo 4,88:1 en modo claro y 5,48:1 en oscuro. Pruebas de reflujo a 320, 375, 430, 768, 1024 y 1440 px, sin desbordamiento horizontal. Comprobados selección por teclado, conservación del foco, modales, filtros vacíos, mapa, idiomas, debates y recuperación de fallos HTTP 503 simulados en un servidor local de prueba.

Las imágenes de preguntas siguen utilizando las fuentes originales y su alternativa de enlace si no se pueden cargar. No se modifican enunciados, respuestas o traducciones.
