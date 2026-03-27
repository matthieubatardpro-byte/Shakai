import os
import json
import time
from dotenv import load_dotenv

load_dotenv(override=True)


def scrape_google_jobs(keywords: str, location: str = "Paris", max_results: int = 10, contract_types: list = None):
    from serpapi import GoogleSearch

    offers = []
    api_key = os.getenv("SERP_API_KEY")

    if not api_key:
        print("SERP_API_KEY manquante")
        return []

    # Variantes de requêtes pour maximiser les résultats
    search_queries = [keywords]
    if contract_types:
        for ct in contract_types:
            search_queries.append(f"{keywords} {ct}")
    
    # Traduction des types de contrats en anglais pour Google Jobs
    contract_translations = {
        "Stage": "stage internship",
        "Alternance": "alternance apprentissage",
        "CDI": "CDI emploi",
        "CDD": "CDD contrat",
        "Freelance": "freelance mission",
        "Interim": "interim mission",
        "Temps partiel": "temps partiel"
    }
    if contract_types:
        for ct in contract_types:
            if ct in contract_translations:
                search_queries.append(f"{keywords} {contract_translations[ct]}")

    seen_titles = set()
    max_pages = max(1, max_results // 10)

    for search_query in search_queries[:3]:  # Max 3 variantes
        next_page_token = None
        pages_fetched = 0

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

            retry = 0
            while retry < 2:
                try:
                    search = GoogleSearch(params)
                    results = search.get_dict()
                    jobs = results.get("jobs_results", [])

                    if not jobs:
                        break

                    for job in jobs:
                        title = job.get("title", "")
                        company = job.get("company_name", "")
                        dedup_key = f"{title.lower()}_{company.lower()}"
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

                        # Description enrichie avec highlights si disponibles
                        description = job.get("description", "")
                        highlights = job.get("job_highlights", [])
                        if highlights:
                            for h in highlights:
                                items = h.get("items", [])
                                description += " " + " ".join(items)

                        offers.append({
                            "source": source,
                            "title": title,
                            "company": company,
                            "location": job.get("location", location),
                            "contract": contract,
                            "description": description[:800],
                            "url": apply_link,
                            "date": posted_at,
                            "metier_suggere": "",
                            "score_matching": 0
                        })

                    next_page_token = results.get("serpapi_pagination", {}).get("next_page_token")
                    pages_fetched += 1

                    if not next_page_token:
                        break
                    break

                except Exception as e:
                    print(f"SERP API error (retry {retry}): {e}")
                    retry += 1
                    time.sleep(1)

            if len(offers) >= max_results * 2:
                break

        if len(offers) >= max_results * 2:
            break

    print(f"Total offres scrapees : {len(offers)}")
    return offers


def enrich_offers_with_details(offers: list) -> list:
    from backend.modules.offer_fetcher import fetch_offer_details
    import concurrent.futures

    def fetch_one(offer):
        try:
            if offer.get("url"):
                details = fetch_offer_details(offer["url"])
                if details.get("full_text") and len(details["full_text"]) > 200:
                    offer["description"] = details["full_text"][:2000]
        except Exception as e:
            print(f"Erreur enrichissement {offer.get('url', '')}: {e}")
        return offer

    print(f"Enrichissement de {len(offers)} offres...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        enriched = list(executor.map(fetch_one, offers))

    print(f"Enrichissement termine")
    return enriched


def calculate_score(offer: dict, cv_data: dict, metier_suggere: str) -> int:
    """Score simple basé sur les mots-clés du CV dans l'offre"""
    score = 50
    description = (offer.get("description", "") + " " + offer.get("title", "")).lower()
    
    if cv_data:
        skills = cv_data.get("skills", [])
        matched_skills = sum(1 for skill in skills if skill.lower() in description)
        score += min(matched_skills * 5, 30)

    if metier_suggere and metier_suggere.lower() in description:
        score += 15

    return min(score, 99)


def filter_offers_with_ai(offers: list, contract_types: list, location: str, cv_data: dict = None, metier_suggere: str = None) -> dict:
    from openai import OpenAI

    if not offers:
        return {"exact": [], "suggested": []}

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Calcul du score matching avant filtrage IA
    for offer in offers:
        offer["score_matching"] = calculate_score(offer, cv_data, metier_suggere)

    offers_summary = []
    for i, offer in enumerate(offers):
        offers_summary.append({
            "index": i,
            "title": offer.get("title", ""),
            "company": offer.get("company", ""),
            "location": offer.get("location", ""),
            "contract": offer.get("contract", ""),
            "description": offer.get("description", "")[:600]
        })

    cv_context = ""
    if cv_data:
        skills = cv_data.get("skills", [])
        experience = cv_data.get("raw_text", "")[:400]
        cv_context = f"""
Profil du candidat :
- Competences : {', '.join(skills[:20])}
- Experience : {experience}
"""

    metier_context = f"- Metier recherche : {metier_suggere}" if metier_suggere else ""
    contrat_context = ', '.join(contract_types) if contract_types else 'Tous types de contrats acceptes'

    prompt = f"""Tu es un expert RH. Classe ces offres d'emploi en deux categories selon leur pertinence.

Criteres :
- Contrat voulu : {contrat_context}
- Localisation : {location if location else 'France entiere'}
{metier_context}
{cv_context}

Offres :
{json.dumps(offers_summary, ensure_ascii=False, indent=2)}

REGLES :
- "exact" : offres qui correspondent bien aux criteres ET au profil. Sois GENEREUX, mets-en un maximum.
- "suggested" : offres interessantes mais pas parfaitement alignees. Mets toutes les offres qui ont un lien avec le profil.
- Rejette UNIQUEMENT les offres completement hors sujet (ex: plombier si le profil est developpeur).
- Si aucun contrat specifique n'est demande, classe tout en "exact".
- Ne rejette pas une offre juste parce que le contrat n'est pas mentionne dans la description.

Reponds UNIQUEMENT avec ce JSON sans markdown ni explication :
{{"exact": [0, 1, 2], "suggested": [3, 4]}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0
        )

        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)

        exact_indices = result.get("exact", [])
        suggested_indices = result.get("suggested", [])

        exact = [offers[i] for i in exact_indices if i < len(offers)]
        suggested = [offers[i] for i in suggested_indices if i < len(offers) and i not in exact_indices]

        # Tri par score matching
        exact.sort(key=lambda x: x.get("score_matching", 0), reverse=True)
        suggested.sort(key=lambda x: x.get("score_matching", 0), reverse=True)

        print(f"Filtrage IA : {len(exact)} offres exactes, {len(suggested)} offres suggerees")
        return {"exact": exact, "suggested": suggested}

    except Exception as e:
        print(f"Erreur filtrage IA : {e}")
        # Fallback : retourner toutes les offres triées par score
        offers.sort(key=lambda x: x.get("score_matching", 0), reverse=True)
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