from pathlib import Path

repo = Path.home() / "Neurolink-v2"
frontend_path = repo / "frontend" / "src" / "main.jsx"

text = frontend_path.read_text()

# Patch sample count calculation and add bandPowers/battery variables
old_counts = (
    "  const eegSampleCount = latest.eeg?.timestamps?.length || 0\n"
    "  const opticalSampleCount = latest.optical?.timestamps?.length || 0\n"
    "  const imuSampleCount = latest.imu?.timestamps?.length || 0\n\n"
)

new_counts = (
    "  const eegSampleCount = latest.eeg?.ts?.length || latest.eeg?.timestamps?.length || 0\n"
    "  const opticalSampleCount = latest.optical?.ts?.length || latest.optical?.timestamps?.length || 0\n"
    "  const imuSampleCount = latest.imu?.ts?.length || latest.imu?.timestamps?.length || 0\n\n"
    "  const bandPowers = latest.eeg?.band_powers || {}\n"
    "  const battery =\n"
    "    latest.eeg?.battery ??\n"
    "    latest.optical?.battery ??\n"
    "    latest.imu?.battery ??\n"
    "    deviceStatus?.battery ??\n"
    "    deviceStatus?.battery_level ??\n"
    "    null\n\n"
)

if old_counts not in text:
    raise SystemExit("Expected sample count block not found in main.jsx; aborting patch.")

text = text.replace(old_counts, new_counts)

# Insert new Battery and Band Powers section before the Discovered devices section
marker = (
    "      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>\n"
    "        <div style={card}>\n"
    "          <h2>Discovered Muse devices</h2>\n"
    "          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(devices, null, 2)}</pre>\n"
    "        </div>\n"
    "        <div style={card}>\n"
    "          <h2>Recent events</h2>\n"
    "          <ul>\n"
    "            {events.map((e) => <li key={e}>{e}</li>)}\n"
    "          </ul>\n"
    "        </div>\n"
    "      </section>\n\n"
)

if marker not in text:
    raise SystemExit("Expected devices/events section marker not found in main.jsx; aborting patch.")

band_section = (
    "      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>\n"
    "        <div style={card}>\n"
    "          <h2>Battery</h2>\n"
    "          <p>{battery == null ? 'No battery data yet' : `${battery}`}</p>\n"
    "        </div>\n"
    "        <div style={card}>\n"
    "          <h2>Band powers</h2>\n"
    "          {Object.keys(bandPowers).length === 0 ? (\n"
    "            <p>No band-power data yet</p>\n"
    "          ) : (\n"
    "            <div>\n"
    "              {Object.entries(bandPowers).map(([channel, bands]) => (\n"
    "                <div key={channel} style={{ marginBottom: 12 }}>\n"
    "                  <strong>{channel}</strong>\n"
    "                  <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(bands, null, 2)}</pre>\n"
    "                </div>\n"
    "              ))}\n"
    "            </div>\n"
    "          )}\n"
    "        </div>\n"
    "      </section>\n\n"
)

text = text.replace(marker, band_section + marker)

frontend_path.write_text(text)
print(f"Updated {frontend_path}")
