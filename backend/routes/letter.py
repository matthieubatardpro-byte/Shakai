from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from backend.modules.letter_generator import generate_letter
from backend.modules.pdf_generator import generate_pdf
from backend.modules.offer_fetcher import fetch_offer_details

router = APIRouter()


class JobOffer(BaseModel):
    source: str = ""
    title: str = ""
    company: str = ""
    location: str = ""
    contract: str = ""
    description: str = ""
    url: str = ""
    metier_suggere: str = ""
    score_matching: int = 0


class LetterRequest(BaseModel):
    cv_data: dict
    job_offer: JobOffer
    tone: str = "professionnel"
    export_pdf: bool = False


@router.post("/generate-letter")
async def create_letter(request: LetterRequest):
    offer_dict = request.job_offer.dict()

    if offer_dict.get("url"):
        print(f"Fetching details depuis : {offer_dict['url']}")
        details = fetch_offer_details(offer_dict["url"])
        if details.get("full_text"):
            offer_dict["description"] = details["full_text"]
            print(f"Description enrichie : {len(details['full_text'])} caracteres")

    letter = generate_letter(
        cv_data=request.cv_data,
        job_offer=offer_dict,
        tone=request.tone
    )

    if request.export_pdf:
        pdf_bytes = generate_pdf(letter)
        company = offer_dict.get("company", "entreprise").replace(" ", "_")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=lettre_{company}.pdf"
            }
        )

    return {"letter": letter}