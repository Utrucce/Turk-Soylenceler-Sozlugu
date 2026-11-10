import json
import os
import random
import re
import pymupdf

PDF_PATH = r"C:\Users\pc\Documents\Türk Efsaneleri Sözlüğü .pdf"
OUT_DIR = r"C:\Users\pc\.gemini\antigravity\scratch\turk-soylenceler-sozlugu\public\data"
os.makedirs(OUT_DIR, exist_ok=True)

random.seed(42)

HEADER_NOISE_PATTERNS = [
    re.compile(r"^S\s*a\s*y\s*f\s*a\s*\|\s*\d+\s*$", re.IGNORECASE),
    re.compile(r"^D\s*e\s*n\s*i\s*z\s+K\s*A\s*R\s*A\s*K\s*U\s*R\s*T\s*$", re.IGNORECASE),
    re.compile(r"^TÜRK SÖYLENCE SÖZLÜĞÜ\s*$"),
]

# Fix occasional PDF encoding artifacts on page 907 etc.
def clean_pdf_text(text: str) -> str:
    text = text.replace("\uf0b7", "•")
    text = text.replace("\xa0", " ")
    text = text.replace("DĠJĠTAL", "DİJİTAL").replace("Ġzinsiz", "İzinsiz")
    return text

def is_header_noise(line_text: str) -> bool:
    s = line_text.strip()
    if not s:
        return True
    for pat in HEADER_NOISE_PATTERNS:
        if pat.match(s):
            return True
    return False

def normalize_tr(s: str) -> str:
    rep = {
        "İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç",
        "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u",
        "Ä": "a", "ä": "a", "Ə": "e", "ə": "e", "Ķ": "k", "ķ": "k",
        "Ḩ": "h", "ḩ": "h", "Ƶ": "z", "ƶ": "z", "Ň": "n", "ň": "n",
        "Ġ": "g", "ġ": "g", "Ţ": "t", "ţ": "t",
    }
    out = []
    for ch in s:
        out.append(rep.get(ch, ch.lower()))
    return "".join(out)

def classify_concept(title: str, short_def: str, extra: str) -> str:
    for text_scope in (title + " " + short_def, title + " " + short_def + " " + extra[:300]):
        low = text_scope.lower()
        if "iyesi" in title.lower() or "koruyucu ruh" in low or ("iye" in low and "ruh" in low):
            return "Ruhlar & İyeler"
        if any(w in low for w in ["tanrıça", "tanrı", "ilâh", "ilah ", "tengri", "yaratıcı", "gök tanrı"]):
            return "Tanrılar & İlahlar"
        if any(w in low for w in ["hakan", "kahraman", "destan", "alp ", "bahadır", "savaşçı", "hükümdar", "şaman", "kam ", "baksı", "efsânevi ata", "atasoy"]):
            return "Kahramanlar & Atalar"
        if any(w in low for w in ["canavar", "ejder", "yılan", "dev ", "cin ", "kötü ruh", "ifrit", "cadı", "kuş", "at ", "kurt", "geyik", "ayı", "yaratık"]):
            return "Mitolojik Varlıklar"
        if any(w in low for w in ["dağ", "ırmak", "nehir", "göl", "deniz", "ağaç", "orman", "mağara", "ülke", "şehir", "kent", "diyar", "yeraltı"]):
            return "Kutsal Doğa & Mekânlar"
    return "İnanç, Tören & Kavramlar"

def extract_book():
    doc = pymupdf.open(PDF_PATH)
    total_pages = len(doc)

    pages_text = []
    chapters = []
    letter_pages = {}

    # Track blocks & lines for both clean page display and concept parsing
    stream_lines = []  # list of (page_1based, max_size, is_bold, text)

    for pno in range(total_pages):
        d = doc[pno].get_text("dict")
        page_paragraphs = []
        current_para = []

        for b in d.get("blocks", []):
            if "lines" not in b:
                continue
            for l in b["lines"]:
                spans = [s for s in l["spans"] if s["text"].strip() or s["text"] == " "]
                if not spans:
                    continue
                raw_line = clean_pdf_text("".join(s["text"] for s in spans)).strip()
                if not raw_line or is_header_noise(raw_line):
                    continue

                max_sz = max(s["size"] for s in spans)
                # Bold flag in PyMuPDF is bit 4 (16) or "Bold" in font name
                is_bold = any((s["flags"] & 16) or ("Bold" in s.get("font", "")) for s in spans if s["text"].strip())

                # Detect letter divider pages (e.g. A, B, ... Z)
                if max_sz >= 80 and len(raw_line) <= 3:
                    ltr = raw_line.upper()
                    if ltr == "H" or raw_line == "h":
                        ltr = "H"
                    letter_pages[pno] = ltr
                    if current_para:
                        page_paragraphs.append(" ".join(current_para))
                        current_para = []
                    page_paragraphs.append(f"# {ltr} Harfi")
                    stream_lines.append((pno + 1, max_sz, True, f"__LETTER__:{ltr}"))
                    continue

                stream_lines.append((pno + 1, max_sz, is_bold, raw_line))

                # Format cleanly for Utrucce StaticBookPageContent
                if max_sz >= 18.0:
                    if current_para:
                        page_paragraphs.append(" ".join(current_para))
                        current_para = []
                    page_paragraphs.append(f"# {raw_line}")
                elif max_sz >= 13.8 and is_bold:
                    if current_para:
                        page_paragraphs.append(" ".join(current_para))
                        current_para = []
                    page_paragraphs.append(f"## {raw_line}")
                elif is_bold and len(raw_line) < 48 and raw_line in (
                    "Özellikleri", "Etimoloji", "Kaynakça", "Dipnotlar", "Ayrıca bakınız",
                    "Kültürel Nitelikleri", "Tarihsel Bağlam", "Anlamı", "Kökeni", "Eşdeğerleri",
                    "ÖNEMLİ AÇIKLAMALAR:", "Yazar Hakkında", "KÜNYE", "KAYNAKÇA"
                ):
                    if current_para:
                        page_paragraphs.append(" ".join(current_para))
                        current_para = []
                    page_paragraphs.append(f"## {raw_line}")
                elif raw_line.startswith("•"):
                    if current_para:
                        page_paragraphs.append(" ".join(current_para))
                        current_para = []
                    page_paragraphs.append(raw_line)
                else:
                    current_para.append(raw_line)
                    if raw_line.endswith((".", "!", "?", ":", "]")) and len(" ".join(current_para)) > 260:
                        page_paragraphs.append(" ".join(current_para))
                        current_para = []

            if current_para:
                page_paragraphs.append(" ".join(current_para))
                current_para = []

        if current_para:
            page_paragraphs.append(" ".join(current_para))

        formatted_page = "\n\n".join(page_paragraphs).strip()
        if not formatted_page:
            formatted_page = f"Sayfa {pno + 1}"
        pages_text.append(formatted_page)

    # Build chapters list
    chapters.append({
        "id": "ch_intro",
        "index": 0,
        "title": "Künye, Ön Söz & Yazar Hakkında",
        "pageStart": 0,
        "pageEnd": 17,
    })
    sorted_letters = sorted(letter_pages.items())
    for idx, (p_idx, ltr) in enumerate(sorted_letters):
        next_start = sorted_letters[idx + 1][0] - 1 if idx + 1 < len(sorted_letters) else 886
        chapters.append({
            "id": f"ch_{ltr}",
            "index": idx + 1,
            "title": f"{ltr} Harfi",
            "pageStart": p_idx,
            "pageEnd": next_start,
        })
    chapters.append({
        "id": "ch_summary",
        "index": len(chapters),
        "title": "Türk Mitolojisi (Özet) & Kaynakça",
        "pageStart": 887,
        "pageEnd": total_pages - 1,
    })

    # Now extract concepts from stream_lines (pages 19..887)
    concepts = []
    current_letter = "A"
    i = 0
    n = len(stream_lines)

    # Helper to check if a line starts a new concept
    def is_concept_start(idx):
        pno, sz, bold, txt = stream_lines[idx]
        if pno < 19 or pno > 887:
            return False
        if txt.startswith("__LETTER__:") or txt.lstrip().startswith("[Az"):
            return False
        clean_t = re.sub(r"\[Az[əe]ric[əe]:.*?\]", "", txt).strip()
        if not clean_t or len(clean_t) > 60:
            return False
        if sz >= 18.0 and bold:
            return True
        if 13.8 <= sz < 18.0 and bold:
            # Sub-entry only if next 1-3 lines start with [Azəricə: or "Title – "
            lookahead = " ".join(stream_lines[j][3] for j in range(idx + 1, min(idx + 4, n)))
            if "[Azəricə:" in lookahead or "[Azəricə:" in txt or "–" in lookahead[:len(clean_t) + 50]:
                if any(ch in clean_t for ch in "ḩƶķňä") and "–" not in lookahead[:60]:
                    return False
                return True
        return False

    cur = None
    cur_section = "main"

    def finalize_concept(c):
        if not c:
            return
        full_body = "\n".join(c["main_lines"]).strip()
        # Clean stray leading title + dash
        azeri_m = re.search(r"\[Az[əe]ric[əe]:\s*([^\]]+)\]", c["raw_header"] + " " + full_body[:200])
        azeri = azeri_m.group(1).strip() if azeri_m else ""
        # Remove [Azəricə: ...] from full_body
        full_body_clean = re.sub(r"\[Az[əe]ric[əe]:\s*[^\]]+\]", "", full_body).strip()

        # Extract aliases from parenthetical right after title at start of body
        aliases = []
        alias_m = re.match(r"^" + re.escape(c["title"]) + r"\s*\(([^)]{2,120})\)\s*[–-]", full_body_clean)
        if alias_m:
            raw_al = alias_m.group(1)
            for part in re.split(r"[,;/]", raw_al):
                part = re.sub(r"^[^:]+:\s*", "", part).strip()
                if part and len(part) >= 2 and part.lower() != c["title"].lower():
                    aliases.append(part)

        # Remove leading "Title (...) – " for clean description
        desc = re.sub(r"^" + re.escape(c["title"]) + r"(?:\s*\([^)]*\))?\s*(?:Han|Ata|Ana)?\s*[–-]\s*", "", full_body_clean).strip()
        if not desc:
            desc = full_body_clean

        # Short def: first 1-2 sentences
        sentences = re.split(r"(?<=[.!?])\s+", desc.replace("\n", " "))
        short_def = ""
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            if not short_def:
                short_def = s
            elif len(short_def) < 95:
                short_def += " " + s
            else:
                break
        if len(short_def) > 260:
            short_def = short_def[:257].rsplit(" ", 1)[0] + "..."

        etymology = " ".join(c["etym_lines"]).strip()
        features = " ".join(c["feat_lines"]).strip()
        see_also = []
        for sl in c["see_lines"]:
            sl_clean = sl.lstrip("•").strip()
            if sl_clean and len(sl_clean) < 60:
                see_also.append(sl_clean)

        if len(desc) < 25:
            return

        concepts.append({
            "id": len(concepts) + 1,
            "title": c["title"],
            "letter": c["letter"],
            "isMain": c["is_main"],
            "azeri": azeri,
            "aliases": aliases[:6],
            "shortDef": short_def,
            "description": desc,
            "features": features,
            "etymology": etymology,
            "seeAlso": see_also[:8],
            "category": classify_concept(c["title"], short_def, desc + " " + features),
            "page": c["page"],
        })

    for idx, (pno, sz, bold, txt) in enumerate(stream_lines):
        if txt.startswith("__LETTER__:"):
            current_letter = txt.split(":", 1)[1]
            continue
        if pno < 19 or pno > 887:
            continue

        if is_concept_start(idx):
            finalize_concept(cur)
            clean_title = re.sub(r"\[Az[əe]ric[əe]:.*?\]", "", txt).strip()
            cur = {
                "title": clean_title,
                "raw_header": txt,
                "letter": current_letter,
                "is_main": sz >= 18.0,
                "page": pno,
                "main_lines": [],
                "feat_lines": [],
                "etym_lines": [],
                "see_lines": [],
            }
            cur_section = "main"
            continue

        if cur is None:
            continue

        # Detect sub-sections
        if bold and txt in ("Özellikleri", "Kültürel Nitelikleri", "Tarihsel Bağlam", "Anlamı"):
            cur_section = "feat"
            continue
        if bold and txt in ("Etimoloji", "Kökeni"):
            cur_section = "etym"
            continue
        if bold and txt in ("Ayrıca bakınız", "Ayrıca Bakınız"):
            cur_section = "see"
            continue
        if bold and txt in ("Kaynakça", "Dipnotlar"):
            cur_section = "skip"
            continue
        # Skip phonetic footer line
        if 13.8 <= sz < 18.0 and not bold or (13.8 <= sz < 18.0 and bold and len(txt) < 40 and cur_section == "skip"):
            continue
        if cur_section == "skip":
            continue
        if cur_section == "main":
            cur["main_lines"].append(txt)
        elif cur_section == "feat":
            cur["feat_lines"].append(txt)
        elif cur_section == "etym":
            cur["etym_lines"].append(txt)
        elif cur_section == "see":
            cur["see_lines"].append(txt)

    finalize_concept(cur)

    # Deduplicate concepts with exact same title+page or near-identical title
    seen_titles = set()
    unique_concepts = []
    for c in concepts:
        key = normalize_tr(c["title"])
        if key in seen_titles:
            continue
        seen_titles.add(key)
        c["id"] = len(unique_concepts) + 1
        unique_concepts.append(c)

    book_payload = {
        "id": "turk_soylenceler_sozlugu",
        "title": "Türk Söylenceler Sözlüğü",
        "subtitle": "Türk Mitoloji Ansiklopedisi • Türk Söylence Sözlüğü",
        "author": "Deniz Karakurt",
        "designer": "Sertan Çubukcu Hoş",
        "totalPages": total_pages,
        "chapters": chapters,
        "pages": pages_text,
    }

    with open(os.path.join(OUT_DIR, "book.json"), "w", encoding="utf-8") as f:
        json.dump(book_payload, f, ensure_ascii=False)

    with open(os.path.join(OUT_DIR, "concepts.json"), "w", encoding="utf-8") as f:
        json.dump(unique_concepts, f, ensure_ascii=False)

    print(f"Book pages: {len(pages_text)}, Chapters: {len(chapters)}, Concepts: {len(unique_concepts)}")
    return unique_concepts


if __name__ == "__main__":
    concepts = extract_book()
    for sample in concepts[:5]:
        print("SAMPLE:", sample["id"], sample["title"], "|", sample["category"], "| p.", sample["page"], "|", sample["shortDef"][:110])
