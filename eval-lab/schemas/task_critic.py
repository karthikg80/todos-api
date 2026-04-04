from pydantic import BaseModel, Field
from typing import Optional


class TaskCriticInput(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = Field(default=None, alias="dueDate")
    priority: Optional[str] = None
    project_context: Optional[str] = None

    model_config = {"populate_by_name": True}


class TaskCriticOutput(BaseModel):
    quality_score: float = Field(ge=0, le=100, alias="qualityScore")
    improved_title: Optional[str] = Field(default=None, alias="improvedTitle")
    improved_description: Optional[str] = Field(
        default=None, alias="improvedDescription"
    )
    suggestions: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}
