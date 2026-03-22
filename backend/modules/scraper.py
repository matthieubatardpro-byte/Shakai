import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(override=True)


def scrape_google_jobs(keywords: str, location: str = "Paris", max_results: int = 10, contract_types: list = None):
    from serpapi import GoogleSearch

    offers = []
    api_key = os.getenv("SERP_API_KEY")

    if not api_key:
        print("SERP_API_KEY manquante")
        return []

    search_query = keywords
    if contract_types:
        search_query = f"{keywords} {' '.join(contract_types)}"

    seen_titles = set()
    next_page_token = None
    pages_fetched = 0
    max_pages = max(1, max_results // 10)

    while pages_fetched < max_pages:
        params = {
            "engine": "google_jobs",
            "q": search_query,
            "location": location if location else "France",
            "hl": "fr",
            "gl": "fr",
            "api_key": api_key,
        }

        if next_page_token:
            params["next_page_token"] = next_page_token

        try:
            search = GoogleSearch(params)
            results = search.get_dict()
            jobs = results.get("jobs_results", [])

            if not jobs:
                break

            for job in jobs:
                title = job.get("title", "")
                company = job.get("company_name", "")
                dedup_key = f"{title}_{company}"
                if dedup_key in seen_titles:
                    continue
                seen_titles.add(dedup_key)

                contract = "Non renseigné"
                extensions = job.get("detected_extensions", {})
                if extensions.get("schedule_type"):
                    contract = extensions["schedule_type"]
                elif contract_types:
                    contract = contract_types[0]

                posted_at = extensions.get("posted_at", "")

                apply_link = ""
                source = "Google Jobs"
                if job.get("apply_options"):
                    apply_link = job["apply_options"][0].get("link", "")
                    source = job["apply_options"][0].get("title", "Google Jobs")
                elif job.get("related_links"):
                    apply_link = job["related_links"][0].get("link", "")
                elif job.get("share_link"):
                    apply_link = job["share_link"]

                offers.append({
                    "source": source,
                    "title": title,
                    "company": company,
                    "location": job.get("location", location),
                    "contract": contract,
                    "description": job.get("description", "")[:500],
                    "url": apply_link,
                    "date": posted_at,
                    "metier_suggere": "",
                    "score_matching": 0
                })

            next_page_token = results.get("serpapi_pagination", {}).get("next_page_token")
            pages_fetched += 1

            if not next_page_token:
                break

        except Exception as e:
            print(f"SERP API error (page {pages_fetched}): {e}")
            break

    print(f"Total offres scrapees : {len(offers)} ({pages_fetched} pages)")
    return offers


def enrich_offers_with_details(offers: list) -> list:
    from backend.modules.offer_fetcher import fetch_offer_details
    import concurrent.futures

    def fetch_one(offer):
        if offer.get("url"):
            details = fetch_offer_details(offer["url"])
            if details.get("full_text") and len(details["full_text"]) > 200:
                offer["description"] = details["full_text"][:2000]
        return offer

    print(f"Enrichissement de {len(offers)} offres...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        enriched = list(executor.map(fetch_one, offers))

    print(f"Enrichissement termine")
    return enriched


def filter_offers_with_ai(offers: list, contract_types: list, location: str, cv_data: dict = None, metier_suggere: str = None) -> dict:
    from openai import OpenAI

    if not offers:
        return {"exact": [], "suggested": []}

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    offers_summary = []
    for i, offer in enumerate(offers):
        offers_summary.append({
            "index": i,
            "title": offer.get("title", ""),
            "company": offer.get("company", ""),
            "location": offer.get("location", ""),
            "contract": offer.get("contract", ""),
            "description": offer.get("description", "")[:500]
        })

    cv_context = ""
    if cv_data:
        cv_context = f"""
    Profil du candidat :
    - Competences : {', '.join(cv_data.get('skills', []))}
    - Experience : {cv_data.get('raw_text', '')[:300]}
    """

    metier_context = ""
    if metier_suggere:
        metier_context = f"- Metier recherche : {metier_suggere}"

    prompt = f"""
    Tu es un expert en recrutement. Analyse ces offres en detail et classe-les en deux categories.
    Les descriptions sont extraites directement des sites d offres donc utilise-les pour evaluer la pertinence.
    
    Criteres demandes :
    - Type de contrat voulu : {', '.join(contract_types) if contract_types else 'Tous'}
    - Ville/region : {location if location else 'France entiere'}
    {metier_context}
    {cv_context}
    
    Offres a analyser :
    {json.dumps(offers_summary, ensure_ascii=False, indent=2)}
    
    CATEGORIE 1 - "exact" : Offres qui correspondent STRICTEMENT aux criteres ET dont la description confirme la pertinence pour le profil.
    Regles strictes :
    - Si "Stage" demande : uniquement les vrais stages confirmes par la description
    - Si "Alternance" demande : uniquement alternance/apprentissage confirmes
    - Si "CDI" demande : uniquement CDI confirmes
    - La localisation doit correspondre
    - La description doit confirmer que le poste correspond au profil du candidat
    - Le niveau d experience requis doit correspondre au profil
    
    CATEGORIE 2 - "suggested" : Offres interessantes pour le profil mais qui ne correspondent pas exactement aux criteres.
    Ces offres doivent quand meme etre pertinentes pour le profil.
    Rejette les offres completement hors sujet.
    
    Reponds UNIQUEMENT avec ce JSON sans markdown :
    {{"exact": [0, 2], "suggested": [1, 4]}}
    
    Un index ne peut pas etre dans les deux categories a la fois.
    Si aucune offre ne correspond a une categorie, mets un tableau vide.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0
        )

        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)

        exact = [offers[i] for i in result.get("exact", []) if i < len(offers)]
        suggested = [offers[i] for i in result.get("suggested", []) if i < len(offers)]

        print(f"Filtrage IA : {len(exact)} offres exactes, {len(suggested)} offres suggerees")
        return {"exact": exact, "suggested": suggested}

    except Exception as e:
        print(f"Erreur filtrage IA : {e}")
        return {"exact": offers, "suggested": []}


async def scrape_offers(keywords: str, location: str = "Paris", max_results: int = 20, contract_types: list = None, cv_data: dict = None, metier_suggere: str = None):
    print(f"Recherche : {keywords} | Lieu : {location} | Contrats : {contract_types}")
    raw_offers = scrape_google_jobs(keywords, location, max_results, contract_types)
    print(f"Google Jobs : {len(raw_offers)} offres trouvees")

    if raw_offers:
        enriched_offers = enrich_offers_with_details(raw_offers)
        result = filter_offers_with_ai(
            offers=enriched_offers,
            contract_types=contract_types or [],
            location=location or "",
            cv_data=cv_data,
            metier_suggere=metier_suggere
        )
        return result

    return {"exact": [], "suggested": []}