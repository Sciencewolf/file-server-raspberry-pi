import requests as rq
import json

def trigger_n8n_workflow() -> dict:
    req = rq.get('https://reflexshop.app.n8n.cloud/webhook/qr-code')

    response = req.json()

    req.raise_for_status()

    
    return dict(response).get('webContentLink')


print(trigger_n8n_workflow())