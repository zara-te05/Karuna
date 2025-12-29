from fastapi import FastAPI
from routers.descriptivo_routes import router as promedios_router

app = FastAPI()

app.include_router(promedios_router)
