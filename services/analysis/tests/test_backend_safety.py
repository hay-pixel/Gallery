from __future__ import annotations

import os
from pathlib import Path

import pytest
from PIL import Image

from analysis_service.backends import (
    UnsupportedMedia,
    _open_rgb_image,
    is_decodable_image,
    temporary_torch_home,
)
from analysis_service.models import AssetInput
from analysis_service.service import AnalysisService


def test_explicit_model_cache_temporarily_overrides_conflicting_torch_home(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    ambient = tmp_path / "ambient-cache"
    explicit = tmp_path / "selected-cache"
    monkeypatch.setenv("TORCH_HOME", str(ambient))

    with temporary_torch_home(explicit):
        assert os.environ["TORCH_HOME"] == str(explicit)

    assert os.environ["TORCH_HOME"] == str(ambient)


def test_decompression_bomb_is_rejected_by_decode_and_backend_open(
    monkeypatch: pytest.MonkeyPatch, canonical_image: tuple[Path, AssetInput]
) -> None:
    path, _ = canonical_image
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1)

    assert is_decodable_image(path) is False
    with pytest.raises(UnsupportedMedia, match="unable to decode"):
        _open_rgb_image(path)


def test_decompression_bomb_is_normalized_by_analysis_service(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    canonical_image: tuple[Path, AssetInput],
    stub_backend: object,
) -> None:
    _, asset = canonical_image
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1)

    result = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis").analyse(asset)  # type: ignore[arg-type]

    assert result.record.status == "failed"
    assert result.record.issues[0].code == "corrupt_media"
    assert result.record.visual_features == []
    assert stub_backend.calls == 0  # type: ignore[attr-defined]
