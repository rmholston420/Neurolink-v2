"""Pydantic-settings configuration loaded from environment / .env file."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # --- Muse S Athena device ---
    muse_mac_address: str = ""
    muse_serial_number: str = ""
    muse_preset: str = "p1041"
    muse_low_latency: bool = True

    # --- Transport backend selection ("brainflow" | "lsl") ---
    transport: str = "brainflow"

    # --- Signal / DSP ---
    # Mains frequency for the notch filter used in signal-mode "notch" (Hz).
    # US default 60; set MAINS_HZ=50 for 50 Hz regions. Not auto-detected.
    mains_hz: float = 60.0

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
