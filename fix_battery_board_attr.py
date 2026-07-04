from pathlib import Path

repo = Path.home() / "Neurolink-v2"
manager_path = repo / "neurolink_v2" / "domain" / "device" / "manager.py"

text = manager_path.read_text()

# Replace self.board with self._board inside get_battery_level
if "get_battery_level" not in text:
    raise SystemExit("get_battery_level not found in manager.py")

text = text.replace("if not self.board:", "if not self._board:")
text = text.replace("board_id = self.board.get_board_id()", "board_id = self._board.get_board_id()")
text = text.replace("data = self.board.get_current_board_data(", "data = self._board.get_current_board_data(")

manager_path.write_text(text)
print(f"Updated {manager_path}")
