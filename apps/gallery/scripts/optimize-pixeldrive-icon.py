from pathlib import Path

from PIL import Image


SOURCE = Path("/home/ubuntu/webdev-static-assets/pixeldrive-icon.png")
TARGETS = [
    Path("/home/ubuntu/pixeldrive-mobile-v2/assets/images/icon.png"),
    Path("/home/ubuntu/pixeldrive-mobile-v2/assets/images/splash-icon.png"),
    Path("/home/ubuntu/pixeldrive-mobile-v2/assets/images/favicon.png"),
    Path("/home/ubuntu/pixeldrive-mobile-v2/assets/images/android-icon-foreground.png"),
]


def main() -> None:
    with Image.open(SOURCE) as original:
        image = original.convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        for target in TARGETS:
            image.save(target, format="PNG", optimize=True, compress_level=9)


if __name__ == "__main__":
    main()
