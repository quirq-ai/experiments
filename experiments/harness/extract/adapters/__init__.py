from .claude_code import normalize as normalize_claude
from .codex import normalize as normalize_codex

PROVIDER_ADAPTERS = {
    "anthropic": normalize_claude,
    "openai": normalize_codex,
}

def get_adapter(provider: str):
    adapter = PROVIDER_ADAPTERS.get(provider)
    if adapter is None:
        raise ValueError(f"No adapter for provider: {provider}. Available: {list(PROVIDER_ADAPTERS)}")
    return adapter
