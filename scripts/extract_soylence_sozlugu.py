import json
import os
import re
import pymupdf

PDF_PATH = r"C:\Users\pc\.gemini\antigravity\scratch\turk-soylenceler-sozlugu\public\docs\Turk-Soylenceler-Sozlugu-Deniz-Karakurt.pdf"
OUT_DIR = r"C:\Users\pc\.gemini\antigravity\scratch\turk-soylenceler-sozlugu\public\data"
os.makedirs(OUT_DIR, exist_ok=True)

HEADER_NOISE_PATTERNS = [
    re.compile(r"^S\s*a\s*y\s*f\s*a\s*\|\s*\d+\s*$", re.IGNORECASE),
    re.compile(r"^D\s*e\s*n\s*i\s*z\s+K\s*A\s*R\s*A\s*K\s*U\s*R\s*T\s*$", re.IGNORECASE),
    re.compile(r"^TÜRK SÖYLENCE SÖZLÜĞÜ\s*$", re.IGNORECASE),
]

TKA_PATTERN = re.compile(r"^\[\s*TKA\s*:\s*([^\]]+)\]", re.IGNORECASE)

NON_CONCEPT_TITLES = {
    "SAYFA", "DOKÜMAN", "EŞDEĞER", "ANLAM", "KÖKEN", "ÖRNEK", "İÇİNDEKİLER",
    "NOT", "AÇIKLAMA", "KAYNAKÇA", "REFERANS", "GİRİŞ", "YÖNTEM", "SÖYLENCE NEDİR",
    "HARFLER", "TABLOLAR", "DİZİN", "EK", "EKLER", "GENEL", "ÖZET"
}

def is_header_noise(line_text: str) -> bool:
    s = line_text.strip()
    if not s:
        return True
    for pat in HEADER_NOISE_PATTERNS:
        if pat.match(s):
            return True
    return False

def clean_text(text: str) -> str:
    text = text.replace("\uf0b7", "•")
    text = text.replace("\xa0", " ")
    text = text.replace("DĠJĠTAL", "DİJİTAL").replace("Ġzinsiz", "İzinsiz")
    text = text.replace("GĠRĠġ", "GİRİŞ").replace("NEDĠR", "NEDİR")
    text = text.replace("DEĞERLERĠ", "DEĞERLERİ")
    return text

def normalize_tr(s: str) -> str:
    rep = {
        "İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç",
        "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u",
        "Ä": "a", "ä": "a", "Ə": "e", "ə": "e", "Ķ": "k", "ķ": "k",
        "Ḩ": "h", "ḩ": "h", "Ƶ": "z", "ƶ": "z", "Ň": "n", "ň": "n",
        "Ġ": "g", "ġ": "g", "Ţ": "t", "ţ": "t",
    }
    return "".join(rep.get(ch, ch.lower()) for ch in s)

def title_case_tr(s: str) -> str:
    words = s.split()
    out = []
    for w in words:
        if not w:
            continue
        first = w[0]
        rest = w[1:]
        if first == "i" or first == "İ":
            first_up = "İ"
        elif first == "ı" or first == "I":
            first_up = "I"
        else:
            first_up = first.upper()
        # lowercase rest properly in TR
        rest_low = []
        for ch in rest:
            if ch == "İ":
                rest_low.append("i")
            elif ch == "I":
                rest_low.append("ı")
            else:
                rest_low.append(ch.lower())
        out.append(first_up + "".join(rest_low))
    return " ".join(out)

def classify_concept(title: str, short_def: str, extra: str) -> str:
    scope = (title + " " + short_def + " " + extra[:300]).lower()
    t_low = title.lower()
    if "iyesi" in t_low or "koruyucu ruh" in scope or ("iye" in scope and "ruh" in scope):
        return "Ruhlar & İyeler"
    if any(w in scope for w in ["tanrıça", "tanrı", "ilâh", "ilah ", "tengri", "yaratıcı", "gök tanrı"]):
        return "Tanrılar & İlahlar"
    if any(w in scope for w in ["hakan", "kahraman", "destan", "alp ", "bahadır", "savaşçı", "hükümdar", "şaman", "kam ", "baksı", "efsânevi ata", "atasoy"]):
        return "Kahramanlar & Atalar"
    if any(w in scope for w in ["canavar", "ejder", "yılan", "dev ", "cin ", "kötü ruh", "ifrit", "cadı", "kuş", "at ", "kurt", "geyik", "ayı", "yaratık"]):
        return "Mitolojik Varlıklar"
    if any(w in scope for w in ["dağ", "ırmak", "nehir", "göl", "deniz", "ağaç", "orman", "mağara", "ülke", "şehir", "kent", "diyar", "yeraltı"]):
        return "Kutsal Doğa & Mekânlar"
    return "İnanç, Tören & Kavramlar"

def build_chapters():
    # Table of contents based on official 392-page PDF
    return [
        {"id": "ch_intro", "index": 0, "title": "Künye & Ön Söz", "pageStart": 0, "pageEnd": 2},
        {"id": "ch_giris", "index": 1, "title": "1. Giriş", "pageStart": 3, "pageEnd": 5},
        {"id": "ch_yontem", "index": 2, "title": "2. Kitapta İzlenen Yöntem", "pageStart": 6, "pageEnd": 8},
        {"id": "ch_soylence", "index": 3, "title": "3. Söylence Nedir?", "pageStart": 9, "pageEnd": 10},
        {"id": "ch_harfler", "index": 4, "title": "4. Harfler ve Ses Değerleri", "pageStart": 11, "pageEnd": 13},
        {"id": "ch_A", "index": 5, "title": "A Harfi", "pageStart": 14, "pageEnd": 62},
        {"id": "ch_B", "index": 6, "title": "B Harfi", "pageStart": 63, "pageEnd": 90},
        {"id": "ch_C", "index": 7, "title": "C Harfi", "pageStart": 91, "pageEnd": 94},
        {"id": "ch_Ç", "index": 8, "title": "Ç Harfi", "pageStart": 95, "pageEnd": 102},
        {"id": "ch_D", "index": 9, "title": "D Harfi", "pageStart": 103, "pageEnd": 111},
        {"id": "ch_E", "index": 10, "title": "E Harfi", "pageStart": 112, "pageEnd": 126},
        {"id": "ch_F", "index": 11, "title": "F Harfi", "pageStart": 127, "pageEnd": 127},
        {"id": "ch_G", "index": 12, "title": "G Harfi", "pageStart": 128, "pageEnd": 138},
        {"id": "ch_H", "index": 13, "title": "H Harfi", "pageStart": 139, "pageEnd": 147},
        {"id": "ch_I", "index": 14, "title": "I Harfi", "pageStart": 148, "pageEnd": 151},
        {"id": "ch_İ", "index": 15, "title": "İ Harfi", "pageStart": 152, "pageEnd": 158},
        {"id": "ch_J", "index": 16, "title": "J Harfi", "pageStart": 159, "pageEnd": 159},
        {"id": "ch_K", "index": 17, "title": "K Harfi", "pageStart": 160, "pageEnd": 206},
        {"id": "ch_L", "index": 18, "title": "L Harfi", "pageStart": 207, "pageEnd": 208},
        {"id": "ch_M", "index": 19, "title": "M Harfi", "pageStart": 209, "pageEnd": 217},
        {"id": "ch_N", "index": 20, "title": "N Harfi", "pageStart": 218, "pageEnd": 222},
        {"id": "ch_O", "index": 21, "title": "O Harfi", "pageStart": 223, "pageEnd": 233},
        {"id": "ch_Ö", "index": 22, "title": "Ö Harfi", "pageStart": 234, "pageEnd": 239},
        {"id": "ch_P", "index": 23, "title": "P Harfi", "pageStart": 240, "pageEnd": 242},
        {"id": "ch_R", "index": 24, "title": "R Harfi", "pageStart": 243, "pageEnd": 243},
        {"id": "ch_S", "index": 25, "title": "S Harfi", "pageStart": 244, "pageEnd": 260},
        {"id": "ch_Ş", "index": 26, "title": "Ş Harfi", "pageStart": 261, "pageEnd": 264},
        {"id": "ch_T", "index": 27, "title": "T Harfi", "pageStart": 265, "pageEnd": 286},
        {"id": "ch_U", "index": 28, "title": "U Harfi", "pageStart": 287, "pageEnd": 297},
        {"id": "ch_Ü", "index": 29, "title": "Ü Harfi", "pageStart": 298, "pageEnd": 301},
        {"id": "ch_V", "index": 30, "title": "V Harfi", "pageStart": 302, "pageEnd": 302},
        {"id": "ch_Y", "index": 31, "title": "Y Harfi", "pageStart": 303, "pageEnd": 331},
        {"id": "ch_Z", "index": 32, "title": "Z Harfi", "pageStart": 332, "pageEnd": 338},
        {"id": "ch_ek", "index": 33, "title": "Ek Tablolar & Motifler", "pageStart": 339, "pageEnd": 383},
        {"id": "ch_kaynakca", "index": 34, "title": "Kaynakça & Ekler", "pageStart": 384, "pageEnd": 391},
    ]

def extract():
    doc = pymupdf.open(PDF_PATH)
    total_pages = len(doc)
    print(f"Loaded PDF: {PDF_PATH} ({total_pages} pages)")

    pages_markdown = []
    raw_concepts = [] # collected concept chunks

    # Pattern for concept header in dictionary section
    concept_hdr_pat = re.compile(r"^([A-ZÇĞİÖŞÜI][A-ZÇĞİÖŞÜI0-9\s\-\'\’]{0,35}):\s*(.*)$")
    letter_div_pat = re.compile(r"^\s*-([A-ZÇĞİÖŞÜI])-\s*$")

    current_concept = None
    current_letter = "A"

    def save_current_concept():
        nonlocal current_concept
        if not current_concept:
            return
        title = current_concept["title"].strip()
        if len(title) < 2 or title.upper() in NON_CONCEPT_TITLES:
            current_concept = None
            return

        body = "\n".join(current_concept["body_lines"]).strip()
        short_def = current_concept["short_def"].strip()
        if not short_def and body:
            first_sent = re.split(r"(?<=[.!?])\s+", body.replace("\n", " "))[0]
            short_def = first_sent[:180]

        aliases = []
        for line in current_concept["esdeger_lines"]:
            clean_al = re.sub(r"^Eşdeğer\s*:\s*", "", line, flags=re.IGNORECASE).strip()
            # Split by comma or semicolon
            for part in re.split(r"[,;/]", clean_al):
                p = re.sub(r"^\d+\.\s*", "", part).strip()
                if p and p.lower() != title.lower():
                    aliases.append(p)

        etymology = " ".join(current_concept["etym_lines"]).strip()
        etymology = re.sub(r"^Anlam\s*:\s*", "", etymology, flags=re.IGNORECASE).strip()

        features = body
        # Clean leading title from features if present
        features = re.sub(r"^" + re.escape(title) + r"\s*:\s*", "", features, flags=re.IGNORECASE).strip()

        cat = classify_concept(title, short_def, features + " " + etymology)

        # Title proper casing: e.g. "Abakan", "Abzar İyesi"
        clean_title = title_case_tr(title)

        raw_concepts.append({
            "title": clean_title,
            "raw_title": title,
            "letter": current_concept["letter"],
            "isMain": True,
            "azeri": current_concept["tka"] or "",
            "aliases": aliases[:8],
            "shortDef": short_def,
            "description": features if len(features) < 350 else (short_def + " " + features[:250]).strip(),
            "features": features,
            "etymology": etymology,
            "seeAlso": [],
            "category": cat,
            "page": current_concept["page"],
        })
        current_concept = None

    for pno in range(total_pages):
        page = doc[pno]
        raw_text = page.get_text()
        clean_p_lines = []
        page_tka_list = []

        for line in raw_text.splitlines():
            l = clean_text(line).strip()
            if not l or is_header_noise(l):
                continue
            tka_m = TKA_PATTERN.match(l)
            if tka_m:
                page_tka_list.append(tka_m.group(1).strip())
                continue
            clean_p_lines.append(l)

        # Markdown formatting for reader
        md_paragraphs = []
        curr_p = []

        for l in clean_p_lines:
            l_div = letter_div_pat.match(l)
            if l_div:
                current_letter = l_div.group(1)
                if curr_p:
                    md_paragraphs.append(" ".join(curr_p))
                    curr_p = []
                md_paragraphs.append(f"# {current_letter} Harfi")
                continue

            c_match = concept_hdr_pat.match(l)
            if c_match and 14 <= pno < 339:
                t = c_match.group(1).strip()
                d = c_match.group(2).strip()
                if t.upper() not in NON_CONCEPT_TITLES and len(t) >= 2:
                    save_current_concept()
                    current_concept = {
                        "title": t,
                        "short_def": d,
                        "letter": current_letter,
                        "page": pno + 1,
                        "esdeger_lines": [],
                        "etym_lines": [],
                        "body_lines": [],
                        "tka": page_tka_list.pop(0) if page_tka_list else "",
                    }
                    if curr_p:
                        md_paragraphs.append(" ".join(curr_p))
                        curr_p = []
                    md_paragraphs.append(f"## {tCase(t)} — {d}" if d else f"## {tCase(t)}")
                    continue

            if current_concept and 14 <= pno < 339:
                if l.startswith("Eşdeğer:"):
                    current_concept["esdeger_lines"].append(l)
                    if curr_p:
                        md_paragraphs.append(" ".join(curr_p))
                        curr_p = []
                    md_paragraphs.append(f"**Eşdeğer:** {l.replace('Eşdeğer:', '').strip()}")
                    continue
                elif l.startswith("Anlam:"):
                    current_concept["etym_lines"].append(l)
                    if curr_p:
                        md_paragraphs.append(" ".join(curr_p))
                        curr_p = []
                    md_paragraphs.append(f"**Anlamı:** {l.replace('Anlam:', '').strip()}")
                    continue
                else:
                    current_concept["body_lines"].append(l)

            # Normal line handling
            if l.startswith(("#", "•", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "10.")):
                if curr_p:
                    md_paragraphs.append(" ".join(curr_p))
                    curr_p = []
                md_paragraphs.append(l)
            else:
                curr_p.append(l)
                if l.endswith((".", ":", "!", "?")) and len(" ".join(curr_p)) > 240:
                    md_paragraphs.append(" ".join(curr_p))
                    curr_p = []

        if curr_p:
            md_paragraphs.append(" ".join(curr_p))

        formatted_page = "\n\n".join(md_paragraphs).strip()
        if not formatted_page:
            formatted_page = f"Sayfa {pno + 1}"
        pages_markdown.append(formatted_page)

    save_current_concept()

    # Deduplicate concepts
    unique_concepts = []
    seen = set()
    for c in raw_concepts:
        key = normalize_tr(c["title"])
        if key in seen:
            continue
        seen.add(key)
        c["id"] = len(unique_concepts) + 1
        unique_concepts.append(c)

    chapters = build_chapters()

    book_payload = {
        "id": "turk_soylenceler_sozlugu",
        "title": "Türk Söylenceler Sözlüğü",
        "subtitle": "Türk Söylence Sözlüğü • Açıklamalı Ansiklopedik Mitoloji Sözlüğü",
        "author": "Deniz Karakurt",
        "designer": "Sertan Çubukcu",
        "totalPages": total_pages,
        "chapters": chapters,
        "pages": pages_markdown,
    }

    with open(os.path.join(OUT_DIR, "book.json"), "w", encoding="utf-8") as f:
        json.dump(book_payload, f, ensure_ascii=False, indent=2)

    with open(os.path.join(OUT_DIR, "concepts.json"), "w", encoding="utf-8") as f:
        json.dump(unique_concepts, f, ensure_ascii=False, indent=2)

    print(f"SUCCESS! Book pages: {len(pages_markdown)}, Chapters: {len(chapters)}, Unique Concepts: {len(unique_concepts)}")
    return unique_concepts

def tCase(s):
    return title_case_tr(s)

if __name__ == "__main__":
    extract()
