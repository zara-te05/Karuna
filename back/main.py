from fastapi import FastAPI
from routers.promedios import router as promedios_router

app = FastAPI()

app.include_router(promedios_router)
