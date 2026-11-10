import json
import os
import random
import re

DATA_DIR = r"C:\Users\pc\.gemini\antigravity\scratch\turk-soylenceler-sozlugu\public\data"
CONCEPTS_PATH = os.path.join(DATA_DIR, "concepts.json")
QUIZ_PATH = os.path.join(DATA_DIR, "quiz.json")

random.seed(2026)

def normalize_tr(s: str) -> str:
    rep = {
        "İ": "i", "I": "ı", "Ğ": "ğ", "Ü": "ü", "Ş": "ş", "Ö": "ö", "Ç": "ç",
        "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u",
        "Ä": "a", "ä": "a", "Ə": "e", "ə": "e", "Ķ": "k", "ķ": "k",
        "Ḩ": "h", "ḩ": "h", "Ƶ": "z", "ƶ": "z", "Ň": "n", "ň": "n",
    }
    return "".join(rep.get(ch, ch.lower()) for ch in s)

def clean_sentence(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    # Remove trailing footnote superscript digits glued to words like "kavşağında1" or "yağdırdığı1"
    s = re.sub(r"([a-zçğıöşüA-ZÇĞİÖŞÜ’'\)\]])\d{1,2}(?=[\s.,;:!?])", r"\1", s)
    s = re.sub(r"([a-zçğıöşüA-ZÇĞİÖŞÜ’'\)\]])\d{1,2}$", r"\1", s)
    return s.strip()

def capitalize_tr(s: str) -> str:
    if not s:
        return s
    first = s[0]
    if first == "i":
        return "İ" + s[1:]
    if first == "ı":
        return "I" + s[1:]
    return first.upper() + s[1:]

def mask_title(text: str, title: str, aliases=None) -> str:
    tokens = [title]
    # Also add stem without plural suffix like Asarı'lar -> Asarı
    stem = re.sub(r"['’]?(?:lar|ler)$", "", title, flags=re.IGNORECASE).strip()
    if len(stem) >= 3:
        tokens.append(stem)
    if aliases:
        tokens.extend(aliases)
    out = text
    for tok in sorted(set(tokens), key=len, reverse=True):
        tok = tok.strip()
        if len(tok) < 3:
            continue
        pat = re.compile(r"\b" + re.escape(tok) + r"(?:['’]?(?:lar|ler|ları|leri|ın|in|un|ün|nın|nin|nun|nün|a|e|ı|i|u|ü|ya|ye|da|de|ta|te|dan|den|tan|ten))?", re.IGNORECASE)
        out = pat.sub("_____", out)
    out = re.sub(r"(_____\s*)+", "_____ ", out).strip()
    return out

def contains_answer(prompt: str, answer: str) -> bool:
    np = normalize_tr(prompt)
    na = normalize_tr(answer)
    stem = re.sub(r"['’]?(?:lar|ler)$", "", na).strip()
    if len(stem) >= 3 and stem in np:
        return True
    parts = [p for p in na.split() if len(p) >= 4 and p not in ("iyesi", "nehri", "inancı", "destanı", "hanım")]
    for p in parts:
        if p in np:
            return True
    return False

def clean_def_for_option(short_def: str, title: str) -> str:
    s = clean_sentence(short_def)
    s = re.sub(r"^" + re.escape(title) + r"\s*[–-]\s*", "", s).strip()
    s = mask_title(s, title)
    # Reject options that start with _____ or lowercase fragments like "bir su ruhu" unless clean
    first = re.split(r"(?<=[.!?])\s+", s)[0].strip()
    if 20 <= len(first) <= 150:
        s = first
    elif len(s) > 150:
        s = s[:147].rsplit(" ", 1)[0] + "..."
    return capitalize_tr(s.strip())

def extract_etym_root(etym_text: str) -> str:
    m = re.search(r"(\([^)]{1,30}\))\s*kök", etym_text)
    if m:
        return m.group(1).strip()
    m2 = re.search(r"\b([A-ZÇĞİÖŞÜ][a-zçğıöşü/]{1,20})\s*kökünden", etym_text)
    if m2:
        return f"({m2.group(1)})"
    return ""

def generate():
    with open(CONCEPTS_PATH, "r", encoding="utf-8") as f:
        concepts = json.load(f)

    # Index by category and title
    by_cat = {}
    title_map = {}
    for c in concepts:
        by_cat.setdefault(c["category"], []).append(c)
        title_map[normalize_tr(c["title"])] = c

    all_titles = [c["title"] for c in concepts if 3 <= len(c["title"]) <= 45]

    def pick_title_distractors(target_c, count=3):
        cat_pool = [c["title"] for c in by_cat.get(target_c["category"], []) if c["id"] != target_c["id"] and 3 <= len(c["title"]) <= 45]
        fallback_pool = [t for t in all_titles if t != target_c["title"]]
        chosen = []
        used = {normalize_tr(target_c["title"])}
        random.shuffle(cat_pool)
        for cand in cat_pool:
            nk = normalize_tr(cand)
            if nk not in used and not contains_answer(cand, target_c["title"]):
                chosen.append(cand)
                used.add(nk)
            if len(chosen) == count:
                return chosen
        random.shuffle(fallback_pool)
        for cand in fallback_pool:
            nk = normalize_tr(cand)
            if nk not in used and not contains_answer(cand, target_c["title"]):
                chosen.append(cand)
                used.add(nk)
            if len(chosen) == count:
                break
        return chosen

    # Precompute clean def options for Type B
    clean_defs = {}
    for c in concepts:
        d = clean_def_for_option(c["shortDef"], c["title"])
        if 22 <= len(d) <= 155 and not contains_answer(d, c["title"]) and "_____" not in d:
            clean_defs[c["id"]] = d

    all_roots = []
    concept_roots = {}
    for c in concepts:
        if c["etymology"]:
            r = extract_etym_root(c["etymology"])
            if r and 3 <= len(r) <= 28:
                concept_roots[c["id"]] = r
                all_roots.append(r)
    unique_roots = list(dict.fromkeys(all_roots))

    questions = []
    seen_prompts = set()

    def add_q(q_text, correct_opt, distractors, category, difficulty, c, explanation):
        if len(distractors) != 3:
            return
        if len(set([correct_opt] + distractors)) != 4:
            return
        key = normalize_tr(q_text)
        if key in seen_prompts:
            return
        seen_prompts.add(key)
        opts = [correct_opt] + distractors
        random.shuffle(opts)
        correct_idx = opts.index(correct_opt)
        questions.append({
            "id": len(questions) + 1,
            "question": q_text,
            "options": opts,
            "correctIndex": correct_idx,
            "category": category,
            "difficulty": difficulty,
            "conceptTitle": c["title"],
            "page": c["page"],
            "explanation": explanation,
        })

    # 1. TYPE A: Definition -> Concept
    for c in concepts:
        if len(c["title"]) < 3 or len(c["title"]) > 45:
            continue
        masked_def = mask_title(clean_sentence(c["shortDef"]), c["title"], c["aliases"])
        masked_def = re.sub(r"^_____\s*[–-]\s*", "", masked_def).strip()
        if len(masked_def) < 28 or contains_answer(masked_def, c["title"]):
            continue
        if len(masked_def) > 220:
            masked_def = masked_def[:217].rsplit(" ", 1)[0] + "..."
        prompt = f"Türk Söylenceler Sözlüğü'nde «{masked_def}» şeklinde açıklanan kavram aşağıdakilerden hangisidir?"
        distractors = pick_title_distractors(c, 3)
        diff = "Kolay" if c["isMain"] and len(c["description"]) > 400 else "Orta"
        q_cat = "Mitolojik Varlıklar & İyeler" if c["category"] in ("Mitolojik Varlıklar", "Ruhlar & İyeler", "Tanrılar & İlahlar") else "Tanım & Kavram"
        add_q(
            prompt, c["title"], distractors,
            q_cat, diff, c,
            clean_sentence(f"{c['title']}: {c['shortDef']} (Sayfa {c['page']})")
        )

    # 2. TYPE B: Concept -> Definition
    def_ids = list(clean_defs.keys())
    for c in concepts:
        if c["id"] not in clean_defs:
            continue
        correct_def = clean_defs[c["id"]]
        same_cat_ids = [x["id"] for x in by_cat.get(c["category"], []) if x["id"] in clean_defs and x["id"] != c["id"]]
        random.shuffle(same_cat_ids)
        picked = []
        used_d = {normalize_tr(correct_def)}
        for did in same_cat_ids:
            cand = clean_defs[did]
            if normalize_tr(cand) not in used_d and not contains_answer(cand, c["title"]):
                picked.append(cand)
                used_d.add(normalize_tr(cand))
            if len(picked) == 3:
                break
        if len(picked) < 3:
            random.shuffle(def_ids)
            for did in def_ids:
                if did == c["id"]:
                    continue
                cand = clean_defs[did]
                if normalize_tr(cand) not in used_d and not contains_answer(cand, c["title"]):
                    picked.append(cand)
                    used_d.add(normalize_tr(cand))
                if len(picked) == 3:
                    break
        prompt = f"Türk mitolojisi ve halk kültüründe «{c['title']}» kavramı aşağıdakilerden hangisini ifade eder?"
        diff = "Kolay" if c["isMain"] else "Orta"
        add_q(
            prompt, correct_def, picked,
            "Tanım & Kavram", diff, c,
            f"{c['title']} (Sayfa {c['page']}): {c['shortDef']}"
        )

    # 3. TYPE C: Etymology Questions (2 variants: Concept->Root and Root->Concept)
    for c in concepts:
        root = concept_roots.get(c["id"])
        if not root:
            continue
        # C1: Concept -> Root
        pool = [r for r in unique_roots if normalize_tr(r) != normalize_tr(root)]
        random.shuffle(pool)
        dist_roots = pool[:3]
        if len(dist_roots) == 3:
            prompt = f"Deniz Karakurt'un Türk Söylenceler Sözlüğü'ne göre «{c['title']}» sözcüğünün etimolojik kökeni aşağıdakilerden hangisidir?"
            add_q(
                prompt, root, dist_roots,
                "Etimoloji & Köken", "Zor", c,
                f"Etimoloji (Sayfa {c['page']}): {c['etymology'][:240]}"
            )

        # C2: Root + short clue -> Concept
        etym_sent = re.split(r"(?<=[.!?])\s+", c["etymology"])
        meaning_clue = ""
        for es in etym_sent[1:3]:
            if len(es) >= 25 and not contains_answer(es, c["title"]):
                meaning_clue = mask_title(es, c["title"], c["aliases"])
                break
        if meaning_clue and len(meaning_clue) <= 180:
            prompt2 = f"Etimolojik olarak {root} kökünden türeyen ve köken açıklamasında «{meaning_clue}» ifadesi geçen kavram hangisidir?"
            dist_t = pick_title_distractors(c, 3)
            add_q(
                prompt2, c["title"], dist_t,
                "Etimoloji & Köken", "Zor", c,
                f"{c['title']} — {c['etymology'][:220]} (Sayfa {c['page']})"
            )

    # 4. TYPE D: Features / Narrative Fact Cloze Questions (up to 2 facts per rich concept)
    for c in concepts:
        blob = clean_sentence((c["features"] + " " + c["description"]).strip())
        sents = re.split(r"(?<=[.!?])\s+", blob)
        added_for_c = 0
        for s in sents[1:]:  # skip very first sentence already used in shortDef
            s = clean_sentence(s)
            if not (45 <= len(s) <= 190):
                continue
            if s.startswith(("Bu ", "Ancak ", "Fakat ", "Ayrıca ", "Örneğin ", "Bazen ", "Çünkü ", "Yâni ", "Yani ", "Onun ", "Ona ", "Bunlar")):
                continue
            masked = mask_title(s, c["title"], c["aliases"])
            if contains_answer(masked, c["title"]):
                continue
            if "_____" in masked:
                prompt = f"Kitaptaki bilgiye göre boş bırakılan yere hangi kavram gelmelidir?\n«{masked}»"
            else:
                if len(s) < 60:
                    continue
                prompt = f"Türk Söylenceler Sözlüğü'nde hakkında «{masked}» bilgisi verilen kavram aşağıdakilerden hangisidir?"
            dist = pick_title_distractors(c, 3)
            add_q(
                prompt, c["title"], dist,
                "Özellikler & Destan", "Orta" if added_for_c == 0 else "Zor", c,
                f"{c['title']} (Sayfa {c['page']}): {s}"
            )
            added_for_c += 1
            if added_for_c >= 2:
                break

    # 5. TYPE E: Alternate Names / Aliases & SeeAlso Relations
    for c in concepts:
        for al in c["aliases"][:2]:
            if len(al) < 3 or len(al) > 35:
                continue
            if normalize_tr(al) == normalize_tr(c["title"]):
                continue
            if contains_answer(al, c["title"]):
                continue
            prompt = f"Türk mitolojisi ve halk kültüründe «{al}» adıyla da bilinen veya anılan kavram aşağıdakilerden hangisidir?"
            dist = pick_title_distractors(c, 3)
            add_q(
                prompt, c["title"], dist,
                "Mitolojik Varlıklar & İyeler" if "iye" in c["category"].lower() or "varlık" in c["category"].lower() else "Tanım & Kavram",
                "Orta", c,
                f"{c['title']} aynı zamanda {al} olarak da bilinir. (Sayfa {c['page']})"
            )

        # SeeAlso relations
        valid_related = [sa for sa in c["seeAlso"] if normalize_tr(sa) in title_map and normalize_tr(sa) != normalize_tr(c["title"])]
        if valid_related:
            rel_title = valid_related[0]
            # Pick 3 distractors that are NOT in seeAlso
            sa_norm = {normalize_tr(x) for x in c["seeAlso"]}
            sa_norm.add(normalize_tr(c["title"]))
            pool = [t for t in all_titles if normalize_tr(t) not in sa_norm and not contains_answer(t, c["title"])]
            random.shuffle(pool)
            dist = pool[:3]
            if len(dist) == 3:
                prompt = f"Türk Söylenceler Sözlüğü'nde «{c['title']}» maddesiyle doğrudan ilişkili ('Ayrıca bakınız') gösterilen kavram aşağıdakilerden hangisidir?"
                add_q(
                    prompt, rel_title, dist,
                    "Özellikler & Destan", "Zor", c,
                    f"{c['title']} maddesinde '{rel_title}' kavramına doğrudan atıf yapılmaktadır. (Sayfa {c['page']})"
                )

    # 6. TYPE F: Category / Protective Spirit (İye) Domain Questions
    iyeler = [c for c in concepts if "iyesi" in c["title"].lower()]
    for c in iyeler:
        domain = c["title"].replace("İyesi", "").strip()
        if len(domain) >= 2:
            dist_iye = [x["title"] for x in iyeler if x["id"] != c["id"]]
            random.shuffle(dist_iye)
            if len(dist_iye) >= 3:
                prompt = f"Türk halk inanışında özellikle «{c['shortDef'][:140]}» ifadesiyle tanımlanan koruyucu ruh (iye) hangisidir?"
                if not contains_answer(prompt, c["title"]):
                    add_q(
                        prompt, c["title"], dist_iye[:3],
                        "Mitolojik Varlıklar & İyeler", "Kolay", c,
                        f"{c['title']} (Sayfa {c['page']}): {c['shortDef']}"
                    )

    random.shuffle(questions)
    for idx, q in enumerate(questions, 1):
        q["id"] = idx

    with open(QUIZ_PATH, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False)

    # Print breakdown
    cats = {}
    diffs = {}
    for q in questions:
        cats[q["category"]] = cats.get(q["category"], 0) + 1
        diffs[q["difficulty"]] = diffs.get(q["difficulty"], 0) + 1
    print(f"Total generated questions: {len(questions)}")
    print("Categories:", cats)
    print("Difficulties:", diffs)
    for sample in questions[:5]:
        print("Q:", sample["question"])
        print("  Opts:", sample["options"], "| Ans:", sample["options"][sample["correctIndex"]])

if __name__ == "__main__":
    generate()
