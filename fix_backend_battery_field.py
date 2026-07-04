from pathlib import Path

repo = Path.home() / "Neurolink-v2"

manager_path = repo / "neurolink_v2" / "domain" / "device" / "manager.py"
broadcaster_path = repo / "neurolink_v2" / "domain" / "stream" / "broadcaster.py"

if not manager_path.exists():
    raise SystemExit(f"manager.py not found: {manager_path}")
if not broadcaster_path.exists():
    raise SystemExit(f"broadcaster.py not found: {broadcaster_path}")

manager_text = manager_path.read_text()
broadcaster_text = broadcaster_path.read_text()

if "def get_battery_level" not in manager_text:
    insert_marker = "class DeviceManager:"
    if insert_marker not in manager_text:
        raise SystemExit("Could not find DeviceManager class marker in manager.py")

    helper = """

    async def get_battery_level(self):
        \"\"\"Best-effort battery extraction from BrainFlow ancillary/status data.\"\"\"
        try:
            if not self.board:
                return None

            from brainflow.board_shim import BoardShim, BrainFlowPresets

            board_id = self.board.get_board_id()
            battery_channel = BoardShim.get_battery_channel(
                board_id,
                BrainFlowPresets.ANCILLARY_PRESET
            )

            data = self.board.get_current_board_data(
                32,
                BrainFlowPresets.ANCILLARY_PRESET
            )
            if data is None or len(data) == 0:
                return None

            if battery_channel < 0 or battery_channel >= len(data):
                return None

            values = data[battery_channel]
            if values is None or len(values) == 0:
                return None

            latest = float(values[-1])

            if 0.0 <= latest <= 1.0:
                return round(latest * 100.0, 2)
            if 0.0 <= latest <= 100.0:
                return round(latest, 2)
            return round(latest, 4)

        except Exception:
            return None
"""
    manager_text = manager_text.replace(insert_marker, insert_marker + helper)

needle = '                snap["band_powers"] = band_powers\n'
if needle in broadcaster_text and 'snap["battery"]' not in broadcaster_text:
    replacement = (
        '                snap["band_powers"] = band_powers\n'
        '                snap["battery"] = await device_manager.get_battery_level()\n'
    )
    broadcaster_text = broadcaster_text.replace(needle, replacement)

optical_needle = '                snap["type"] = "optical"\n'
if optical_needle in broadcaster_text and 'snap["battery"] = await device_manager.get_battery_level()' not in broadcaster_text:
    optical_replacement = (
        '                snap["type"] = "optical"\n'
        '                snap["battery"] = await device_manager.get_battery_level()\n'
    )
    broadcaster_text = broadcaster_text.replace(optical_needle, optical_replacement)

manager_path.write_text(manager_text)
broadcaster_path.write_text(broadcaster_text)

print(f"Updated {manager_path}")
print(f"Updated {broadcaster_path}")
