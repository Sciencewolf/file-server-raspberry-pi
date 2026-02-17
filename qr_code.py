import requests as rq
import os, dotenv

dotenv.load_dotenv()

def trigger_n8n_workflow() -> dict:
    req = rq.get(os.getenv('API'))

    response = req.json()

    req.raise_for_status()

    
    return dict(response).get('webContentLink')