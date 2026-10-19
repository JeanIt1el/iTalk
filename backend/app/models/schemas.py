from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


CEFR_LEVEL = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
SKILL_TYPE = Literal[
    "conversation", "grammar", "vocabulary", "speaking", "listening"
]
MESSAGE_ROLE = Literal["user", "assistant", "system"]


class ApiError(BaseModel):
    error: str
    code: str
    details: dict | None = None


class ApiResponse(BaseModel):
    data: object | None = None
    message: str | None = None
    success: bool = True


class AuthRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)


class RegisterRequest(AuthRequest):
    name: str = Field(min_length=2, max_length=120)


class LoginResponse(BaseModel):
    user: dict
    is_authenticated: bool
    token: str


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    native_language: str | None = Field(default=None, min_length=2, max_length=20)
    target_language: str | None = Field(default=None, min_length=2, max_length=20)
    level: CEFR_LEVEL | None = None
    goals: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    pace: Literal["casual", "regular", "intensive"] | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=1, le=480)


class LearningPreferences(BaseModel):
    daily_goal_minutes: int = Field(ge=1, le=480)
    topics: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)


class ProfileResponse(BaseModel):
    id: UUID
    name: str
    email: str
    avatar_url: str | None = None
    interface_language: str
    target_language: str
    cefr_level: CEFR_LEVEL
    goals: list[str]
    interests: list[str]
    pace: str
    daily_goal_minutes: int
    streak_days: int = 0
    total_minutes_studied: int = 0
    joined_at: datetime
    preferences: dict


class ConversationScenario(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    level: CEFR_LEVEL
    estimated_duration: int


class ConversationSessionCreate(BaseModel):
    scenario: Literal["free_talk"] = "free_talk"
    title: str | None = None
    description: str | None = None


class ConversationMessage(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    role: MESSAGE_ROLE
    content: str
    translation: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    corrections: list[dict] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class ConversationSession(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    scenario: str
    title: str
    description: str
    level: CEFR_LEVEL
    messages: list[ConversationMessage] = Field(default_factory=list)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    duration: int = 0
    messages_count: int = 0
    corrections_count: int = 0
    summary: dict | None = None


class ConversationMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    show_translation: bool = False
    enable_corrections: bool = True


class ConversationSummary(BaseModel):
    session_id: UUID
    duration: int
    messages_exchanged: int
    corrections_count: int
    strengths: list[str]
    areas_to_improve: list[str]
    new_vocabulary: list[dict]
    overall_score: int = Field(ge=0, le=100)


class Correction(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    message_id: UUID
    original_text: str
    corrected_text: str
    category: Literal["spelling", "grammar", "punctuation", "word_choice", "syntax"]
    explanation: str


class VocabularyItem(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    word: str
    translation: str
    language: str
    phonetic: str = ""
    part_of_speech: str = ""
    example: str = ""
    example_translation: str = ""
    level: CEFR_LEVEL
    collection: str
    srs_level: int = Field(ge=0, le=5)
    next_review: datetime
    last_reviewed: datetime | None = None


class VocabularyItemCreate(BaseModel):
    word: str = Field(min_length=1, max_length=200)
    translation: str = Field(min_length=1, max_length=500)
    context_sentence: str | None = Field(default=None, max_length=2000)


class VocabularyWordResponse(BaseModel):
    slug: str
    word: str
    translation_fr: str
    additional_meanings: list[str] = Field(default_factory=list)
    part_of_speech: str
    cefr_level: CEFR_LEVEL
    ipa: str | None = None
    example_en: str
    example_fr: str
    usage_note_fr: str | None = None
    synonyms: list[str] = Field(default_factory=list)
    antonyms: list[str] = Field(default_factory=list)
    collocations: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    source_type: Literal["seeded", "ai_generated"] = "seeded"
    mastery_level: int = Field(default=0, ge=0, le=5)
    next_review_at: datetime | None = None
    is_favorite: bool = False


class VocabularyCollectionResponse(BaseModel):
    slug: str
    title: str
    description: str
    icon: str
    cefr_level: CEFR_LEVEL
    word_count: int = Field(ge=0)
    mastered_count: int = Field(ge=0)


class VocabularyReviewRequest(BaseModel):
    item_slug: str = Field(min_length=1, max_length=120)
    rating: Literal["again", "hard", "good", "easy"]
    request_id: UUID = Field(default_factory=uuid4)


class VocabularyReviewResponse(BaseModel):
    item_slug: str
    rating: Literal["again", "hard", "good", "easy"]
    mastery_level: int = Field(ge=0, le=5)
    next_review_at: datetime
    duplicate: bool = False


QUIZ_QUESTION_TYPE = Literal["multiple_choice", "write_word", "fill_blank"]


class VocabularyQuizCreateRequest(BaseModel):
    collection_slug: str | None = Field(default=None, max_length=120)
    level: CEFR_LEVEL | None = None
    count: int = Field(default=10, ge=3, le=20)
    question_types: list[QUIZ_QUESTION_TYPE] = Field(
        default_factory=lambda: ["multiple_choice", "write_word", "fill_blank"],
        min_length=1,
        max_length=3,
    )


class VocabularyQuizQuestion(BaseModel):
    index: int = Field(ge=0)
    type: QUIZ_QUESTION_TYPE
    prompt: str
    options: list[str] = Field(default_factory=list)


class VocabularyQuizResponse(BaseModel):
    id: UUID
    questions: list[VocabularyQuizQuestion]
    answered_count: int = Field(ge=0)
    status: Literal["active", "completed", "abandoned"]
    score: int | None = Field(default=None, ge=0, le=100)


class VocabularyQuizAnswerRequest(BaseModel):
    question_index: int = Field(ge=0)
    answer: str = Field(min_length=1, max_length=300)


class VocabularyQuizAnswerResponse(BaseModel):
    question_index: int
    is_correct: bool
    correct_answer: str
    explanation: str


class VocabularyScenarioResponse(BaseModel):
    slug: str
    title: str
    description: str
    cefr_level: CEFR_LEVEL
    learning_objective: str
    situation: str
    useful_phrases: list[str]
    words: list[VocabularyWordResponse] = Field(default_factory=list)


class GeneratedVocabularyWord(BaseModel):
    model_config = {"extra": "forbid"}

    word: str = Field(min_length=1, max_length=100)
    translation_fr: str = Field(min_length=1, max_length=200)
    part_of_speech: str = Field(min_length=1, max_length=40)
    cefr_level: CEFR_LEVEL
    ipa: str = Field(default="", max_length=100)
    example_en: str = Field(min_length=1, max_length=300)
    example_fr: str = Field(min_length=1, max_length=300)
    usage_note_fr: str = Field(min_length=1, max_length=500)
    synonyms: list[str] = Field(default_factory=list, max_length=5)
    tags: list[str] = Field(default_factory=list, max_length=8)


class VocabularyGenerateRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=120)
    level: CEFR_LEVEL
    count: int = Field(default=8, ge=3, le=10)
    goal: str = Field(default="", max_length=300)


class VocabularyGenerateResponse(BaseModel):
    items: list[GeneratedVocabularyWord]
    source_type: Literal["ai_generated"] = "ai_generated"


class SavedGeneratedVocabularyWord(GeneratedVocabularyWord):
    id: UUID
    created_at: datetime
    source_type: Literal["ai_generated"] = "ai_generated"


class VocabularyExplainRequest(BaseModel):
    word: str = Field(min_length=1, max_length=100)
    translation_fr: str = Field(min_length=1, max_length=200)
    comparison_word: str | None = Field(default=None, max_length=100)


class VocabularyExplainResponse(BaseModel):
    explanation_fr: str = Field(min_length=1, max_length=1500)
    examples: list[str] = Field(min_length=1, max_length=4)
    common_mistake_fr: str = Field(min_length=1, max_length=500)


class LearningSessionCreate(BaseModel):
    module_type: SKILL_TYPE
    scenario: str | None = None
    title: str | None = None
    description: str | None = None
    level: CEFR_LEVEL = "B1"


class LearningSessionComplete(BaseModel):
    duration_seconds: int = Field(ge=0)
    score: int | None = Field(default=None, ge=0, le=100)


class SpeechRecordingRequest(BaseModel):
    transcript: str
    duration: int = Field(ge=0)
    pronunciation_score: int = Field(ge=0, le=100)


class ProgressOverview(BaseModel):
    total_minutes: int
    total_lessons: int
    current_streak: int
    longest_streak: int
    weekly_minutes: int
    weekly_goal: int
    skill_scores: list[dict]
    cefr_progression: list[dict]
    recent_activities: list[dict]
    recommendations: list[dict]


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    supabase_configured: bool
    groq_configured: bool


class UserContext(BaseModel):
    user_id: UUID
    access_token: str
    email: str
    full_name: str = ""
