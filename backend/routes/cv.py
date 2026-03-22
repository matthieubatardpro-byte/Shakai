from fastapi import APIRouter, UploadFile, File, Form
from backend.modules.cv_parser import parse_cv
from backend.modules.cv_analyzer import analyze_cv_and_suggest_jobs
from backend.modules.scraper import scrape_offers
import shutil
import os

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    result = parse_cv(file_path)
    return {"filename": file.filename, "cv_data": result}


@router.post("/analyze-cv")
async def analyze_cv(file: UploadFile = File(...)):
    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    cv_data = parse_cv(file_path)
    analysis = analyze_cv_and_suggest_jobs(cv_data)
    return {"filename": file.filename, "cv_data": cv_data, "analysis": analysis}


@router.post("/analyze-and-search")
async def analyze_and_search(
    file: UploadFile = File(...),
    location: str = Form("Paris"),
    max_results: int = Form(50),
    contract_types: str = Form(""),
    prioritized_metiers: str = Form("")
):
    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cv_data = parse_cv(file_path)
    analysis = analyze_cv_and_suggest_jobs(cv_data)

    contracts = [c.strip() for c in contract_types.split(",") if c.strip()] if contract_types else []
    print(f"Location recue : {location}")
    print(f"Contrats recus : {contracts}")

    import json
    try:
        prioritized = json.loads(prioritized_metiers) if prioritized_metiers else []
    except Exception:
        prioritized = []

    metiers = analysis.get("metiers_suggeres", [])

    if prioritized:
        metiers_sorted = []
        for titre in prioritized:
            for m in metiers:
                if m.get("titre") == titre and m.get("active", True) is not False:
                    metiers_sorted.append(m)
                    break
        metiers = metiers_sorted if metiers_sorted else metiers

    metiers = metiers[:5]
    all_exact = []
    all_suggested = []

    for metier in metiers:
        keywords_list = metier.get("keywords_recherche", [metier.get("titre", "")])

        for keywords_combo in [
            " ".join(keywords_list[:2]),
            " ".join(keywords_list[1:3]) if len(keywords_list) > 1 else keywords_list[0],
            metier.get("titre", "")
        ]:
            if contracts:
                keywords_combo = f"{keywords_combo} {' '.join(contracts)}"

            scrape_location = "" if location == "partout" else location
            result = await scrape_offers(
                keywords=keywords_combo,
                location=scrape_location,
                max_results=10,
                contract_types=contracts,
                cv_data=cv_data,
                metier_suggere=metier.get("titre", "")
            )

            for offer in result.get("exact", []):
                offer["metier_suggere"] = metier.get("titre", "")
                offer["score_matching"] = metier.get("score_matching", 0)
                all_exact.append(offer)

            for offer in result.get("suggested", []):
                offer["metier_suggere"] = metier.get("titre", "")
                offer["score_matching"] = metier.get("score_matching", 0)
                all_suggested.append(offer)

    seen = set()
    unique_exact = []
    for o in all_exact:
        key = f"{o.get('title')}_{o.get('company')}"
        if key not in seen:
            seen.add(key)
            unique_exact.append(o)

    seen_s = set()
    unique_suggested = []
    for o in all_suggested:
        key = f"{o.get('title')}_{o.get('company')}"
        if key not in seen_s and key not in seen:
            seen_s.add(key)
            unique_suggested.append(o)

    unique_exact.sort(key=lambda x: x.get("score_matching", 0), reverse=True)
    unique_suggested.sort(key=lambda x: x.get("score_matching", 0), reverse=True)

    return {
        "filename": file.filename,
        "cv_data": cv_data,
        "analysis": analysis,
        "offers": unique_exact[:max_results],
        "suggested_offers": unique_suggested[:10],
        "total_offers": len(unique_exact)
    }