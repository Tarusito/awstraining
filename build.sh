#!/bin/sh
set -eux
python -m zipfile -e nube-source.zip .
cp ui/*.html ui/*.css ui/*.mjs ui/*.svg study/
python -m pip install -r requirements-render.txt
python render_prepare.py

cmp ui/index.html study/index.html
cmp ui/app.mjs study/app.mjs
cmp ui/styles.css study/styles.css
sha256sum study/index.html study/app.mjs study/styles.css

cmp ui/service-icons.svg study/service-icons.svg
cmp ui/service-icons.mjs study/service-icons.mjs
