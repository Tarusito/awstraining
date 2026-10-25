"""Prepare Nube with the pinned, checksum-verified translation release artifact."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "scripts"))
import prepare_render

prepare_render.MODEL_URL = "https://github.com/Tarusito/awstraining/releases/download/translation-model-v1/en-es.argosmodel"

if __name__ == "__main__":
    prepare_render.validate_bank()
    prepare_render.prepare_model()
