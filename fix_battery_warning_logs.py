from pathlib import Path

repo = Path.home() / "Neurolink-v2"
manager_path = repo / "neurolink_v2" / "domain" / "device" / "manager.py"

text = manager_path.read_text()

old = """    async def get_battery_level(self):
        \"\"\"Best-effort battery extraction from BrainFlow ancillary/status data.\"\"\"
        import logging

        log = logging.getLogger(__name__)

        try:
            if not self._board:
                log.debug(\"battery: no board\")
                return None

            from brainflow.board_shim import BoardShim, BrainFlowPresets

            board_id = self._board.get_board_id()
            battery_channel = BoardShim.get_battery_channel(
                board_id,
                BrainFlowPresets.ANCILLARY_PRESET
            )
            log.debug(\"battery: board_id=%s battery_channel=%s\", board_id, battery_channel)

            data = self._board.get_current_board_data(
                32,
                BrainFlowPresets.ANCILLARY_PRESET
            )

            if data is None or len(data) == 0:
                log.debug(\"battery: no ancillary data\")
                return None

            if battery_channel < 0 or battery_channel >= len(data):
                log.debug(\"battery: channel index out of range; data shape=%s\", len(data))
                return None

            values = data[battery_channel]
            if values is None or len(values) == 0:
                log.debug(\"battery: channel has no values\")
                return None

            latest = float(values[-1])
            log.debug(\"battery: raw latest=%s\", latest)

            if 0.0 <= latest <= 1.0:
                pct = round(latest * 100.0, 2)
                log.debug(\"battery: normalized 0..1 -> %s%%\", pct)
                return pct
            if 0.0 <= latest <= 100.0:
                pct = round(latest, 2)
                log.debug(\"battery: normalized 0..100 -> %s%%\", pct)
                return pct

            val = round(latest, 4)
            log.debug(\"battery: returning raw=%s\", val)
            return val

        except Exception as e:
            log.exception(\"battery: error while reading level: %s\", e)
            return None
"""

new = """    async def get_battery_level(self):
        \"\"\"Best-effort battery extraction from BrainFlow ancillary/status data.\"\"\"
        import logging

        log = logging.getLogger(__name__)

        try:
            if not self._board:
                log.warning(\"battery: no board\")
                return None

            from brainflow.board_shim import BoardShim, BrainFlowPresets

            board_id = self._board.get_board_id()
            battery_channel = BoardShim.get_battery_channel(
                board_id,
                BrainFlowPresets.ANCILLARY_PRESET
            )
            log.warning(\"battery: board_id=%s battery_channel=%s\", board_id, battery_channel)

            data = await asyncio.to_thread(
                self._board.get_current_board_data,
                32,
                BrainFlowPresets.ANCILLARY_PRESET,
            )

            if data is None or len(data) == 0:
                log.warning(\"battery: no ancillary data\")
                return None

            if battery_channel < 0 or battery_channel >= len(data):
                log.warning(\"battery: channel index out of range; data shape=%s\", len(data))
                return None

            values = data[battery_channel]
            if values is None or len(values) == 0:
                log.warning(\"battery: channel has no values\")
                return None

            latest = float(values[-1])
            log.warning(\"battery: raw latest=%s\", latest)

            if 0.0 <= latest <= 1.0:
                pct = round(latest * 100.0, 2)
                log.warning(\"battery: normalized 0..1 -> %s%%\", pct)
                return pct
            if 0.0 <= latest <= 100.0:
                pct = round(latest, 2)
                log.warning(\"battery: normalized 0..100 -> %s%%\", pct)
                return pct

            val = round(latest, 4)
            log.warning(\"battery: returning raw=%s\", val)
            return val

        except Exception as e:
            log.exception(\"battery: error while reading level: %s\", e)
            return None
"""

if old not in text:
    raise SystemExit("Expected get_battery_level block not found; aborting patch.")

text = text.replace(old, new)
manager_path.write_text(text)
print(f"Updated {manager_path}")
