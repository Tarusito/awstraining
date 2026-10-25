# Nube — AWS Training

Web de estudio con 9.822 preguntas en inglés y español, debates de Cloud Practitioner
 y Solutions Architect Associate, 333 fichas de servicios y 28 agrupaciones de certificación.

`nube-source.zip` contiene la copia completa de la aplicación y sus datos ya preparados.
`build.sh` la extrae, instala el traductor offline y verifica el banco de preguntas y el modelo.

## Render Free

- Tipo: Web Service, Python.
- Plan: Free.
- Build command: `sh build.sh`.
- Start command: `python scripts/start_study.py`.
- Environment: `HOST=0.0.0.0`; Render proporciona `PORT`.
- Health check: `/healthz`.

No requiere claves API. El progreso se guarda en cada navegador. Render Free puede
suspender el servicio por inactividad y la caché de traducción se regenera tras reinicios.
