"""LLM generation with provider fallback and offline template answers.

If no provider key is configured (demo mode), the generator returns a
deterministic marker so the assembler can render catalog data directly as a
structured template answer — no hallucinated prose.
"""

import logging
from typing import AsyncGenerator, List

from app.core.config import get_settings
from app.rag.system_prompt import SYSTEM_PROMPT

logger = logging.getLogger(__name__)
settings = get_settings()

TEMPLATE_MARKER = "__TEMPLATE_FALLBACK__"


class LLMGenerator:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.gemini_client = None
        self.gemini_model_name = "gemini-flash-latest"
        self.groq_client = None
        self.ollama_client = None

        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            try:
                import sys
                from google import genai

                self.gemini_client = genai.Client(
                    api_key=settings.GEMINI_API_KEY,
                )
                print(f"[GEMINI] Client initialized with model: {self.gemini_model_name}", file=sys.stderr)
                logger.info("Gemini client initialized with model: %s", self.gemini_model_name)
            except Exception:
                print(f"[GEMINI] Init failed: {sys.exc_info()[1]}", file=sys.stderr)
                logger.exception("Gemini init failed")
        elif self.provider == "groq" and settings.GROQ_API_KEY:
            try:
                from groq import Groq

                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception:
                logger.exception("Groq init failed")
        elif self.provider == "ollama":
            try:
                import ollama

                self.ollama_client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            except Exception:
                logger.exception("Ollama init failed")

    @property
    def available(self) -> bool:
        return bool(self.gemini_client or self.groq_client or self.ollama_client)

    def _groq_call(self, client, stream: bool = False):
        return client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "Follow the section template in the prompt.",
                },
            ],
            temperature=0.1,
            max_tokens=2048,
            stream=stream,
        )

    def generate(self, prompt: str) -> str:
        if self.gemini_client:
            try:
                response = self.gemini_client.models.generate_content(
                    model=self.gemini_model_name,
                    contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
                )
                return response.text
            except Exception:
                logger.exception("Gemini generate failed")
        if self.groq_client:
            try:
                response = self.groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                )
                return response.choices[0].message.content
            except Exception:
                logger.exception("Groq generate failed")
        if self.ollama_client:
            try:
                response = self.ollama_client.generate(
                    model=settings.OLLAMA_MODEL,
                    prompt=f"{SYSTEM_PROMPT}\n\n{prompt}",
                    options={"temperature": 0.1},
                )
                return response["response"]
            except Exception:
                logger.exception("Ollama generate failed")
        return TEMPLATE_MARKER

    async def stream_generate(self, prompt: str) -> AsyncGenerator[str, None]:
        if self.gemini_client:
            try:
                response = self.gemini_client.models.generate_content_stream(
                    model=self.gemini_model_name,
                    contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception:
                logger.exception("Gemini stream failed")
        if self.groq_client:
            try:
                stream = self.groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                    stream=True,
                )
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                return
            except Exception:
                logger.exception("Groq stream failed")
        if self.ollama_client:
            try:
                stream = self.ollama_client.generate(
                    model=settings.OLLAMA_MODEL,
                    prompt=f"{SYSTEM_PROMPT}\n\n{prompt}",
                    options={"temperature": 0.1},
                    stream=True,
                )
                for chunk in stream:
                    if chunk.get("response"):
                        yield chunk["response"]
                return
            except Exception:
                logger.exception("Ollama stream failed")

        # Offline: yield the final answer word by word for a smooth streaming UX
        full = self.generate(prompt)
        for word in full.split(" "):
            yield word + " "
            if word is None:
                break

    def _chunk_text(self, text: str, chunk_size: int = 50) -> List[str]:
        words = text.split()
        return [
            " ".join(words[i : i + chunk_size])
            for i in range(0, len(words), chunk_size)
        ]


generator = LLMGenerator()
