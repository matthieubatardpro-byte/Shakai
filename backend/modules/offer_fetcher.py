import requests
from bs4 import BeautifulSoup
import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

def fetch_offer_details(url: str) -> dict:
    if not url:
        return {"description": "", "full_text": ""}

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
    }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        for tag in soup(["script", "style", "nav", "header", "footer", "iframe", "img"]):
            tag.decompose()

        selectors = [
            "[class*='job-description']",
            "[class*='jobDescription']",
            "[class*='offer-description']",
            "[class*='description']",
            "[id*='job-description']",
            "[id*='description']",
            "article",
            "main",
        ]

        content = ""
        for selector in selectors:
            element = soup.select_one(selector)
            if element and len(element.get_text(strip=True)) > 200:
                content = element.get_text(separator="\n", strip=True)
                break

        if not content:
            content = soup.get_text(separator="\n", strip=True)

        content = "\n".join([line for line in content.split("\n") if line.strip()])
        content = content[:3000]

        print(f"Offre fetched : {len(content)} caracteres depuis {url}")
        return {"description": content[:500], "full_text": content}

    except Exception as e:
        print(f"Erreur fetch offre {url}: {e}")
        return {"description": "", "full_text": ""}
        