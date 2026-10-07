from fastapi import APIRouter, Depends
from uuid import UUID

from app.api.dependencies import get_user_id
from app.models.schemas import SpeechRecordingRequest

router = APIRouter(prefix="/speech", tags=["Speech"])


@router.post("/transcribe")
async def transcribe_audio(
    payload: SpeechRecordingRequest, user_id: UUID = Depends(get_user_id)
) -> dict:
    return {
        "transcript": payload.transcript,
        "duration": payload.duration,
        "pronunciation_score": payload.pronunciation_score,
        "feedback": {
            "overall_score": payload.pronunciation_score,
            "fluency": max(0, payload.pronunciation_score - 10),
            "accuracy": payload.pronunciation_score,
            "pacing": 70,
            "issues": [],
            "strengths": ["Prononciation claire"],
        },
    }


@router.post("/text-to-speech")
async def text_to_speech(text: str, user_id: UUID = Depends(get_user_id)) -> dict:
    return {"audio_url": f"/api/v1/speech/audio/{len(text)}", "text": text}
