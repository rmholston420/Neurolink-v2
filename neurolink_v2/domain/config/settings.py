"""Pydantic-settings configuration loaded from environment / .env file."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # --- Muse S Athena device ---
    muse_mac_address: str = ""
    muse_serial_number: str = ""
    muse_preset: str = "p1041"
    muse_low_latency: bool = True

    # --- Server ---
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "info"

    # --- Database ---
    database_url: str = "sqlite+aiosqlite:///./neurolink.db"

    @property
    def brainflow_other_info(self) -> str:
        """Build the BrainFlowInputParams.other_info string."""
        ll = "true" if self.muse_low_latency else "false"
        return f"preset={self.muse_preset};low_latency={ll}"


settings = Settings()
