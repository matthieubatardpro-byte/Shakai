from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from backend.routes.cv import router as cv_router
from backend.routes.letter import router as letter_router
from backend.routes.jobs import router as jobs_router
import os

load_dotenv()

app = FastAPI(title="Shakai API")

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

@app.get("/api")
def root():
    return {"message": "Shakai API fonctionne !"}

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    index = os.path.join(frontend_path, "index.html")
    return FileResponse(index)