from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv(override=True)

def generate_letter(cv_data: dict, job_offer: dict, tone: str = "professionnel"):

    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)

    cv_summary = f"""
    Nom : {cv_data.get('name', 'Prénom Nom')}
    Email : {cv_data.get('email', 'Non renseigné')}
    Téléphone : {cv_data.get('phone', 'Non renseigné')}
    Compétences : {', '.join(cv_data.get('skills', []))}
    Expérience extraite : {cv_data.get('raw_text', '')}
    """

    prompt = f"""
    Tu es un expert en rédaction de lettres de motivation professionnelles françaises.
    
    Voici le profil complet du candidat :
    {cv_summary}
    
    Voici l'offre d'emploi :
    - Poste : {job_offer.get('title', 'Non renseigné')}
    - Entreprise : {job_offer.get('company', 'Non renseignée')}
    - Localisation : {job_offer.get('location', 'Non renseignée')}
    - Type de contrat : {job_offer.get('contract', 'Non renseigné')}
    - Description : {job_offer.get('description', 'Non renseignée')}
    
    Rédige une lettre de motivation en suivant EXACTEMENT ce format :

    Matthieu Batard
    [Email]
    [Téléphone]

    Objet : [Intitulé exact du poste] chez [Nom entreprise]

    Madame, Monsieur,

    [Paragraphe 1 - Accroche : présentation du candidat, diplômes, et intention de candidature. 3-4 lignes.]

    [Paragraphe 2 - Expérience principale : détailler la première expérience la plus pertinente pour le poste avec des tâches concrètes. 4-5 lignes.]

    [Paragraphe 3 - Compétences complémentaires : relier les autres expériences et compétences aux besoins du poste. 4-5 lignes.]

    [Paragraphe 4 - Compétences transverses : soft skills, outils maîtrisés, qualités personnelles en lien avec le poste. 3-4 lignes.]

    [Paragraphe 5 - Motivation pour l'entreprise : montrer que le candidat connaît l'entreprise et son secteur. 2-3 lignes.]

    Je serais ravi(e) de pouvoir échanger avec vous afin de vous exposer plus en détail ma motivation et l'adéquation de mon profil avec vos besoins.

    Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

    [Nom Prénom]
    
    Règles strictes :
    - Ne jamais inventer d'expériences absentes du CV
    - Citer explicitement l'entreprise et le poste
    - Relier chaque compétence à un besoin mentionné dans l'offre
    - Ton {tone}, naturel et professionnel
    - Commencer directement par le nom du candidat, sans tirets ni commentaires
    """

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.7
    )

    return response.choices[0].message.content
    