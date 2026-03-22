from fastapi import APIRouter
from backend.modules.scraper import scrape_offers

router = APIRouter()

@router.get("/jobs/search")
async def search_jobs(keywords: str, location: str = "Paris", max_results: int = 10):
    offers = await scrape_offers(
        keywords=keywords,
        location=location,
        max_results=max_results
    )
    return {
        "total": len(offers),
        "offers": offers
    }
    