"""Controlled normalization for compact classifier-sourced browse/search metadata."""

from __future__ import annotations

import re
from collections.abc import Iterable

from .models import ConfidenceLabel

_WHITESPACE = re.compile(r"\s+")
_NON_WORD = re.compile(r"[^a-z0-9 -]")

# Only high-certainty normalizations are made here. Unknown terms retain a
# stable lower-case phrase rather than receiving risky linguistic rewrites.
_SYNONYMS = {
    "cellular telephone": "mobile phone",
    "cellular phone": "mobile phone",
    "laptop computer": "laptop",
    "notebook computer": "laptop",
    "television system": "television",
    "tv monitor": "television",
    "sports car": "car",
    "passenger car": "car",
    "minivan": "van",
    "pickup": "pickup truck",
    "jeep": "car",
    "airliner": "airplane",
    "warplane": "airplane",
    "sailboat": "boat",
    "motorboat": "boat",
    "mountain bike": "bicycle",
    "dining table": "table",
    "coffee table": "table",
    "studio couch": "sofa",
    "couch": "sofa",
    "book jacket": "book",
    "comic book": "book",
    "tabby": "cat",
    "tiger cat": "cat",
    "persian cat": "cat",
    "siamese cat": "cat",
    "labrador retriever": "dog",
    "golden retriever": "dog",
    "german shepherd": "dog",
    "chihuahua": "dog",
    "pug": "dog",
    "french bulldog": "dog",
}

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "animal": (
        "dog",
        "cat",
        "bird",
        "horse",
        "cow",
        "sheep",
        "goat",
        "elephant",
        "bear",
        "zebra",
        "giraffe",
        "monkey",
        "ape",
        "fish",
        "shark",
        "whale",
        "dolphin",
        "butterfly",
        "insect",
        "spider",
        "snake",
        "lizard",
        "turtle",
        "frog",
        "rabbit",
        "hamster",
        "lion",
        "tiger",
    ),
    "vehicle": (
        "car",
        "truck",
        "bus",
        "train",
        "airplane",
        "boat",
        "bicycle",
        "motorcycle",
        "van",
        "tractor",
        "ambulance",
        "fire engine",
        "locomotive",
        "ship",
    ),
    "food": (
        "pizza",
        "hamburger",
        "cheeseburger",
        "hotdog",
        "ice cream",
        "cake",
        "bread",
        "fruit",
        "banana",
        "apple",
        "orange",
        "strawberry",
        "spaghetti",
        "sushi",
        "plate",
        "guacamole",
    ),
    "furniture": (
        "chair",
        "table",
        "sofa",
        "bed",
        "desk",
        "wardrobe",
        "bookcase",
        "lamp",
        "cabinet",
    ),
    "electronics": (
        "laptop",
        "computer",
        "mobile phone",
        "television",
        "monitor",
        "keyboard",
        "camera",
        "printer",
        "radio",
        "projector",
    ),
}


def normalize_term(value: str) -> str:
    """Apply conservative casing, spacing, synonym, and allow-listed plural normalization."""
    normal = _NON_WORD.sub(" ", value.strip().casefold())
    normal = _WHITESPACE.sub(" ", normal).strip(" -")
    normal = _SYNONYMS.get(normal, normal)
    plural_map = {
        "dogs": "dog",
        "cats": "cat",
        "cars": "car",
        "buses": "bus",
        "trucks": "truck",
        "boats": "boat",
        "bicycles": "bicycle",
        "motorcycles": "motorcycle",
        "chairs": "chair",
        "tables": "table",
        "books": "book",
        "screens": "screen",
        "people": "person",
    }
    return plural_map.get(normal, normal)


def broad_categories(value: str) -> list[str]:
    """Return compact broad classes only from controlled classifier mappings."""
    normal = normalize_term(value)
    return [
        category
        for category, keywords in _CATEGORY_KEYWORDS.items()
        if normal in keywords or any(keyword in normal.split() for keyword in keywords)
    ]


def _deduplicate(labels: Iterable[ConfidenceLabel]) -> list[ConfidenceLabel]:
    best: dict[tuple[str, str | None], ConfidenceLabel] = {}
    for item in labels:
        normalized = normalize_term(item.label)
        if not normalized:
            continue
        candidate = ConfidenceLabel(normalized, item.confidence, item.source)
        key = (candidate.label, candidate.source)
        current = best.get(key)
        if current is None or (candidate.confidence or 0.0) > (current.confidence or 0.0):
            best[key] = candidate
    return sorted(
        best.values(), key=lambda item: (-(item.confidence or 0.0), item.label, item.source or "")
    )


def normalize_classifier_labels(
    labels: Iterable[ConfidenceLabel], *, max_tags: int = 24, min_confidence: float = 0.05
) -> tuple[list[ConfidenceLabel], list[ConfidenceLabel]]:
    """Return controlled classifier-sourced categories and tags.

    A whole-image classifier is not a grounded detector, so this function never
    returns object observations. The `source: classifier` semantics remain
    explicit for every emitted concept.
    """
    selected = [
        item for item in labels if item.confidence is None or item.confidence >= min_confidence
    ]
    tags = _deduplicate(
        ConfidenceLabel(normalize_term(item.label), item.confidence, "classifier")
        for item in selected
    )[:max_tags]
    categories = _deduplicate(
        ConfidenceLabel(category, item.confidence, "classifier")
        for item in tags
        for category in broad_categories(item.label)
    )
    return categories, tags


def summary_for(tags: list[ConfidenceLabel], categories: list[ConfidenceLabel]) -> str | None:
    """Make a bounded classifier-derived summary without claiming object detection."""
    if not tags:
        return None
    primary = tags[0].label
    if categories:
        return (
            f"Whole-image classifier associated this image with {primary} ({categories[0].label})."
        )
    return f"Whole-image classifier associated this image with {primary}."
