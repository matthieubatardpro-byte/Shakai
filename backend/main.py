from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from backend.routes.cv import router as cv_router
from backend.routes.letter import router as letter_router
from backend.routes.jobs import router as jobs_router
import os

load_dotenv()

app = FastAPI(title="Job Finder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cv_router, prefix="/api")
app.include_router(letter_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Job Finder API fonctionne !"}
    


