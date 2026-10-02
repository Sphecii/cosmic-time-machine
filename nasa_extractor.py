import os
from pathlib import Path

import requests


CELESTIAL_KEYWORDS = [
    "planet", "moon", "star", "asteroid", "comet", "galaxy", "nebula",
    "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
    "venus", "mercury", "sun", "crater", "meteor",
]

EXCLUDED_KEYWORDS = [
    "rover", "apollo", "suit", "satellite", "rocket", "shuttle", "station",
    "probe", "orbiter", "lander", "module", "telescope", "voyager", "cassini",
    "hubble", "jwst", "landsat", "galileo", "iss",
]

REPO_OWNER = "nasa"
REPO_NAME = "NASA-3D-Resources"
TARGET_DIRECTORY = "3D Models"
API_BASE = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
OUTPUT_DIRECTORY = Path(__file__).parent / "public" / "models"
REQUEST_TIMEOUT = 30


def is_celestial(name):
    """Check if the item name matches the celestial criteria."""
    name_lower = name.lower()

    if any(blacklisted in name_lower for blacklisted in EXCLUDED_KEYWORDS):
        return False

    return any(whitelisted in name_lower for whitelisted in CELESTIAL_KEYWORDS)


def download_file(item, destination):
    response = requests.get(item["download_url"], timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(response.content)
    print(f"[DOWNLOADED] {destination.relative_to(OUTPUT_DIRECTORY)}")


def download_tree(item, destination):
    if item["type"] == "file":
        download_file(item, destination)
        return

    response = requests.get(item["url"], timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    for child in response.json():
        download_tree(child, destination / child["name"])


def scan_and_export():
    """Find matching celestial models and download their complete folders."""
    print("Initiating deep space scan...\n")
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    response = requests.get(
        f"{API_BASE}/{TARGET_DIRECTORY}",
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    matches = [item for item in response.json() if is_celestial(item["name"])]
    if not matches:
        print("No matching celestial model folders found.")
        return

    for item in matches:
        print(f"[MATCH FOUND] {item['name']}")
        download_tree(item, OUTPUT_DIRECTORY / item["name"])


if __name__ == "__main__":
    try:
        scan_and_export()
    except requests.RequestException as error:
        raise SystemExit(f"NASA 3D Resources download failed: {error}") from error