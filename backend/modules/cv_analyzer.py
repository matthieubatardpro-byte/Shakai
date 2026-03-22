from openai import OpenAI
from dotenv import load_dotenv
import os
import json

load_dotenv(override=True)

def analyze_cv_and_suggest_jobs(cv_data: dict) -> dict:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    prompt = f"""
    Tu es un expert en orientation professionnelle et en recrutement.
    
    Voici le profil extrait d'un CV :
    - Compétences détectées : {', '.join(cv_data.get('skills', []))}
    - Expérience extraite : {cv_data.get('raw_text', '')}
    - Email : {cv_data.get('email', '')}
    
    Effectue une analyse complète de ce profil et réponds UNIQUEMENT avec un JSON valide
    sans aucun texte avant ou après, sans balises markdown, sans ```json.
    
    Le JSON doit avoir exactement cette structure :
    {{
        "profil_summary": "Résumé du profil en 2-3 phrases",
        "niveau": "Junior / Confirmé / Senior",
        "secteurs": ["secteur1", "secteur2", "secteur3"],
        "metiers_suggeres": [
            {{
                "titre": "Intitulé exact du métier",
                "score_matching": 95,
                "raison": "Pourquoi ce métier correspond au profil",
                "keywords_recherche": ["mot-clé1", "mot-clé2", "mot-clé3"]
            }}
        ],
        "competences_cles": ["compétence1", "compétence2", "compétence3"],
        "points_forts": ["point fort 1", "point fort 2"],
        "axes_amelioration": ["axe 1", "axe 2"]
    }}
    
    Propose entre 5 et 8 métiers pertinents classés par score de matching décroissant.
    Les keywords_recherche seront utilisés pour scraper les offres d'emploi.
    """

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.3
    )

    raw = response.choices[0].message.content.strip()
    
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = {
                "profil_summary": "Analyse non disponible",
                "niveau": "Non déterminé",
                "secteurs": [],
                "metiers_suggeres": [],
                "competences_cles": cv_data.get('skills', []),
                "points_forts": [],
                "axes_amelioration": []
            }
    
    return result
    