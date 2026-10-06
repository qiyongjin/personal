from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(max_length=12000)]
ShortText = Annotated[str, StringConstraints(max_length=1000)]
Identifier = Annotated[str, StringConstraints(min_length=1, max_length=80)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
PointText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]
Locale = Literal["zh", "en"]


class Model(BaseModel):
    model_config = ConfigDict(strict=True, extra="ignore")


class Bullet(Model):
    id: Identifier
    text: PointText


Points = Annotated[list[Bullet], Field(max_length=100)]


class Section(Model):
    id: Identifier
    title: Title


class BulletSection(Section):
    type: Literal["bullets"]
    items: Points


class Skill(Model):
    id: Identifier
    title: Title
    points: Points


class SkillsSection(Section):
    type: Literal["skills"]
    items: Annotated[list[Skill], Field(max_length=100)]


class Project(Model):
    id: Identifier
    company: ShortText
    name: Title
    start: ShortText
    end: ShortText
    role: ShortText
    technologies: ShortText
    description: Text
    responsibilitiesLabel: Title
    outcomesLabel: Title
    responsibilities: Points
    outcomes: Points


class ProjectsSection(Section):
    type: Literal["projects"]
    items: Annotated[list[Project], Field(max_length=100)]


class TextSection(Section):
    type: Literal["text"]
    content: Text


ResumeSection = Annotated[
    BulletSection | SkillsSection | ProjectsSection | TextSection, Field(discriminator="type")
]


class Contact(Model):
    id: Identifier
    label: ShortText
    value: ShortText


class Basics(Model):
    name: Title
    headline: ShortText
    city: ShortText
    jobType: ShortText
    salary: ShortText
    phone: ShortText
    email: ShortText
    contacts: Annotated[list[Contact], Field(max_length=20)] = Field(default_factory=list)


class ResumeData(Model):
    basics: Basics
    sections: Annotated[list[ResumeSection], Field(max_length=30)]

    @model_validator(mode="after")
    def unique_ids(self) -> "ResumeData":
        seen: set[str] = set()

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                if "id" in value:
                    if value["id"] in seen:
                        raise ValueError("条目 ID 不能重复")
                    seen.add(value["id"])
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(self.model_dump())
        return self


class EnglishResume(Model):
    data: ResumeData
    source: ResumeData


class ResumeRecord(Model):
    data: ResumeData
    english: EnglishResume | None = None
    version: int = Field(gt=0)
    updatedAt: str

    def localized(self, locale: Locale) -> "ResumeRecord":
        if locale == "en":
            if not self.english or self.english.source != self.data:
                raise ValueError("英文简历尚未发布或需要更新，请先查看中文版。")
            return self.model_copy(update={"data": self.english.data})
        return self


class SaveResume(Model):
    data: ResumeData
    version: int = Field(gt=0)
    english: EnglishResume | None = None


class TranslationInput(Model):
    data: ResumeData


class LoginInput(Model):
    username: Annotated[str, StringConstraints(max_length=200)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=1024)]


class SessionStatus(Model):
    authenticated: bool
