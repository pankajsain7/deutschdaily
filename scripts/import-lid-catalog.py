"""Generate the German LiD catalog from the BAMF PDF and verified Testcenter choices."""

import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PDF_URL = (
    "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/"
    "gesamtfragenkatalog-lebenindeutschland.pdf?__blob=publicationFile&v=22"
)
TESTCENTER_URL = "https://oet.bamf.de/ords/oetut/f?p=534:1:0:::::"
REGULATION_URL = "https://www.gesetze-im-internet.de/einbtestv/anlage_1.html"
STATUTORY_IMAGES = {
    "de-055": "Schwarz-Weiß-Aufnahme eines großen Gebäudes mit Säuleneingang und einer Kuppel.",
    "de-070": "Gustav Heinemann hält mit Helmut Schmidt die geöffnete Mappe mit der Ernennungsurkunde.",
    "de-181": "Willy Brandt kniet vor einem Kranz. Hinter ihm stehen die Teilnehmenden der Gedenkfeier.",
    "de-216": "Blick in den Plenarsaal mit halbrunden Sitzreihen. An der Stirnseite hängt ein Wappentier mit ausgebreiteten Flügeln.",
    "de-235": "François Mitterrand und Helmut Kohl halten sich an den Händen. Vor ihnen stehen zwei Kränze und ein Sarg.",
}
PDF_IMAGES = {
    "de-021": 4, "de-130": 1, "de-176": 1, "de-187": 1,
    "de-209": 4, "de-226": 4, "bw-01": 4, "bw-08": 1,
}


def compact(text: str) -> str:
    return " ".join(text.replace("\u00ad", "").split())


def question_id(scope: str, number: int) -> str:
    return f"{scope}-{number:0{3 if scope == 'de' else 2}d}"


def read_pdf(pdf: Path) -> tuple[str, list[dict[str, Any]]]:
    text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], encoding="utf-8")
    edition = re.search(r"Stand:\s*(\d{2}\.\d{2}\.\d{4})", text)
    if not edition:
        raise ValueError("BAMF-Katalogstand nicht gefunden.")

    questions = []
    scope = "de"
    for page, content in enumerate(text.split("\f"), start=1):
        if "Fragen für das Bundesland Baden-Württemberg" in content:
            scope = "bw"
        elif "Fragen für das Bundesland " in content:
            break
        content = re.sub(r"(?m)^[ \t]*Seite \d+ von \d+[ \t]*$", "", content)
        parts = re.split(r"(?m)^[ \t]*Aufgabe (\d+)[ \t]*\n", content)
        for number, block in zip(parts[1::2], parts[2::2]):
            identifier = question_id(scope, int(number))
            prompt, *options = map(compact, re.split(r"(?m)^[ \t]*[\uf0a3□][ \t]*", block))
            prompt = re.sub(r" Bild 1 Bild 2 Bild 3 Bild 4$", "", prompt)
            prompt, _, _credit = prompt.partition(" © ")
            prompt = prompt.removesuffix(" In Anlehnung an Bundeswahlordnung (BWO), Anlage 26")
            if not prompt or len(options) != 4 or len(set(options)) != 4 or not all(options):
                raise ValueError(f"{identifier}: Fragetext und vier eindeutige Antworten erwartet.")
            questions.append({"id": identifier, "page": page, "prompt": prompt, "options": options})

    expected = [question_id("de", n) for n in range(1, 301)]
    expected.extend(question_id("bw", n) for n in range(1, 11))
    if [item["id"] for item in questions] != expected:
        raise ValueError("Erwartet wurden Aufgaben 1–300 und Landesaufgaben 1–10 in Katalogreihenfolge.")
    return edition[1], questions


def checked_answer(question: dict[str, Any], record: dict[str, Any]) -> int:
    def normalized(text: str) -> str:
        return re.sub(r"[^\w]", "", text.casefold().removeprefix("bild "))

    choices = record.get("options", [])
    answer = record.get("answer")
    if len(choices) != 4 or type(answer) is not int or not 0 <= answer < 4:
        raise ValueError(f"{question['id']}: offizieller Lösungseintrag ungültig.")

    official = choices[answer]
    if question["id"] == "de-005":
        official = re.sub(r"^Der Wähler\b", "Die Wählerin/der Wähler", official)
    candidates = [i for i, option in enumerate(question["options"]) if normalized(option) == normalized(official)]
    if not candidates:
        # The BAMF PDF often lists the same feminine and masculine forms in reverse order.
        tokens = sorted(re.findall(r"\w+", official.casefold()))
        candidates = [
            i for i, option in enumerate(question["options"])
            if sorted(re.findall(r"\w+", option.casefold())) == tokens
        ]
    if len(candidates) != 1:
        raise ValueError(f"{question['id']}: Lösung manuell prüfen ({official!r}, {question['options']!r}).")
    return candidates[0]


def figure_descriptions(pdf: Path) -> dict[str, list[str]]:
    structure = subprocess.check_output(["pdfinfo", "-enc", "UTF-8", "-struct-text", str(pdf)])
    descriptions = defaultdict(list)
    scope, number = "de", 0
    for line in structure.splitlines():
        if b"Fragen f" in line and b"Bundesland Baden-W" in line:
            scope = "bw"
        elif b"Fragen f" in line and b"Bundesland " in line:
            break
        heading = re.fullmatch(rb'\s*"Aufgabe\s+(\d+)\s*"\s*', line)
        if heading:
            number = int(heading[1])
        alt = re.fullmatch(rb'\s*Figure "" \["(.*)"\]:', line)
        if alt:
            description = alt[1].rstrip(b"\0").decode("cp1252").strip()
            description = re.sub(r"\?+(?=\d+\.)", " ", description).rstrip("?")
            descriptions[question_id(scope, number)].append(compact(description))
    if set(descriptions) != PDF_IMAGES.keys() | STATUTORY_IMAGES.keys():
        raise ValueError("Abbildungsaufgaben haben sich geändert. Bitte die Zuordnung prüfen.")
    return descriptions


def render_pdf_images(pdf: Path, questions: list[dict[str, Any]], assets: Path) -> None:
    import pdfplumber

    with pdfplumber.open(pdf) as document:
        for item in questions:
            identifier = item["id"]
            if identifier not in PDF_IMAGES:
                continue
            page = document.pages[item["page"] - 1]
            images = sorted((image for image in page.images if image["top"] > 120), key=lambda image: image["x0"])
            if len(images) != PDF_IMAGES[identifier]:
                raise ValueError(f"{identifier}: Bildausschnitte erneut prüfen.")
            for index, image in enumerate(images, start=1):
                suffix = f"-{index}" if len(images) > 1 else ""
                target = assets / f"{identifier}{suffix}.png"
                box = (image["x0"], image["top"], image["x1"], image["bottom"])
                page.crop(box).to_image(resolution=144, antialias=True).save(target, quantize=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("answers", type=Path, help="JSONL mit den im BAMF Online-Testcenter eingeblendeten Lösungen.")
    parser.add_argument("--verified", type=date.fromisoformat, required=True)
    parser.add_argument("--src", type=Path, default=ROOT / "src")
    args = parser.parse_args()

    edition, questions = read_pdf(args.pdf)
    answers = [json.loads(line) for line in args.answers.read_text(encoding="utf-8").splitlines()]
    if [row.get("number") for row in answers] != list(range(1, 311)):
        raise ValueError("Die offiziellen Lösungen 1–310 sind unvollständig oder falsch sortiert.")
    descriptions = figure_descriptions(args.pdf)
    assets = args.src / "assets" / "lid"
    assets.mkdir(parents=True, exist_ok=True)
    render_pdf_images(args.pdf, questions, assets)

    for item, official in zip(questions, answers):
        identifier = item["id"]
        item["answer"] = checked_answer(item, official)
        if identifier in STATUTORY_IMAGES:
            item["figures"] = [{"file": f"{identifier}.jpg", "alt": STATUTORY_IMAGES[identifier]}]
        elif identifier in PDF_IMAGES:
            alts = descriptions[identifier]
            if len(alts) != PDF_IMAGES[identifier]:
                raise ValueError(f"{identifier}: Unvollständige Bildbeschreibungen.")
            item["figures"] = [
                {"file": f"{identifier}{f'-{i}' if len(alts) > 1 else ''}.png", "alt": alt}
                for i, alt in enumerate(alts, start=1)
            ]
        content = [item["prompt"], item["options"], item["answer"]]
        for figure in item.get("figures", []):
            file = assets / figure["file"]
            content.append(hashlib.sha256(file.read_bytes()).hexdigest())
        item["revision"] = hashlib.sha256(json.dumps(content, ensure_ascii=False).encode()).hexdigest()[:16]

    metadata = {
        "edition": edition,
        "verified": args.verified.isoformat(),
        "revision": hashlib.sha256("".join(item["revision"] for item in questions).encode()).hexdigest(),
        "pdf": PDF_URL,
        "testCenter": TESTCENTER_URL,
        "regulation": REGULATION_URL,
    }
    catalog = args.src / "lid-catalog.js"
    with catalog.open("w", encoding="utf-8") as output:
        output.write("// Generated from the official BAMF catalog and Online-Testcenter. See scripts/import-lid-catalog.py.\n")
        output.write(f"const LID_SOURCE = {json.dumps(metadata, ensure_ascii=False, indent=2)};\n\n")
        output.write("const LID_QUESTIONS = [\n")
        for item in questions:
            output.write("  " + json.dumps(item, ensure_ascii=False) + ",\n")
        output.write("];\n")
    print(f"{catalog}: {len(questions)} geprüfte Aufgaben, BAMF-Stand {edition}.")


if __name__ == "__main__":
    main()
