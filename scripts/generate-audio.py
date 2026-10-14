"""Generate original, short mono UI tones using only Python's standard library."""
import math
import struct
import wave
from pathlib import Path
assets = Path(__file__).resolve().parent.parent / 'assets'
assets.mkdir(exist_ok=True)
for name, (freq, duration) in {'tap': (420, .045), 'place': (620, .09), 'squeeze': (260, .13), 'error': (150, .1), 'win': (880, .28)}.items():
    with wave.open(str(assets / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(22050)
        samples = []
        for i in range(int(22050 * duration)):
            t = i / 22050
            envelope = min(1, t / .005) * (1 - t / duration) ** 2
            phase = 2 * math.pi * (freq * t + (160 * t * t / (2 * duration) if name == 'squeeze' else 0))
            samples.append(struct.pack('<h', int(5000 * envelope * math.sin(phase))))
        output.writeframes(b''.join(samples))
