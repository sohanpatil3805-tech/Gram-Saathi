from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.ai.providers.base import AIResponse
from backend.api.routes import create_router

class FakeRepository:
    def load(self): pass
    def find_for_beneficiary(self, group, state):
        return [{"scheme_id":"TEST_SCHEME","name":{"en":"Test Scheme","kn":"ಪರೀಕ್ಷಾ ಯೋಜನೆ","hi":"परीक्षण योजना"},
                 "summary":{"en":"A test scheme","kn":"ಪರೀಕ್ಷೆ","hi":"एक परीक्षण योजना"},
                 "benefit":{"description":"Demo benefit"},"jurisdiction":"central",
                 "verification_status":"discovery_only","eligibility_rules":[],"required_documents":[],
                 "important_current_notes":[],"official_urls":["https://example.gov.in"]}]
    def sources_for_scheme(self, scheme_id): return []
    def all_schemes(self): return []
    def get_scheme(self, scheme_id): return None

class FakeAIProvider:
    async def generate(self, prompt, system_instruction=None, tools=None, temperature=0.2):
        assert "Test Scheme" in prompt
        assert "Never claim" in system_instruction
        return AIResponse(text="Test Scheme may be relevant. Check the official source.",
                          model_name="test-model", provider_name="mock", is_simulated=True)

def client():
    app=FastAPI()
    app.include_router(create_router(FakeRepository(), FakeAIProvider()))
    return TestClient(app)

def test_chat_asks_for_beneficiary_group():
    r=client().post("/api/chat", json={"message":"Find a scheme","language":"en"})
    assert r.status_code==200 and r.json()["needs_clarification"] is True

def test_chat_asks_for_beneficiary_group_in_all_three_languages():
    for lang, expected_substr in [("en", "farmer"), ("kn", "ರೈತ"), ("hi", "किसान")]:
        r = client().post("/api/chat", json={"message": "Find a scheme", "language": lang})
        assert r.status_code == 200
        assert r.json()["needs_clarification"] is True
        assert expected_substr in r.json()["reply"]

def test_chat_uses_discovery_and_provider():
    r=client().post("/api/chat", json={"message":"What can help me?","beneficiary_group":"farmers",
                                      "state":"Karnataka","language":"en"})
    assert r.status_code==200
    assert r.json()["provider"]=="mock"
    assert r.json()["is_simulated"] is True
    assert r.json()["scheme_ids"]==["TEST_SCHEME"]

def test_chat_rejects_unsupported_language():
    r=client().post("/api/chat", json={"message":"Hello","beneficiary_group":"farmers","language":"fr"})
    assert r.status_code==422

def test_chat_rejects_sensitive_identity_data_before_ai_call():
    r=client().post("/api/chat", json={"message":"My Aadhaar is 1234 5678 9012","beneficiary_group":"farmers","language":"en"})
    assert r.status_code == 422
    assert "remove Aadhaar" in r.json()["detail"]
