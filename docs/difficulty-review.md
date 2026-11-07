# Difficulty review

Reviewed 45 consecutive daily sets, November 7–December 21, 2026 (225 shapes).
Measured the rounded outlines at the same 16 subdivisions per curve used by
the renderer, rather than relying only on the original control polygons.

| Level | Curved concavity range | Mean curved concavity | Mean inward corners before rounding |
| --- | --- | --- | --- |
| 1 | 0% | 0% | 0 |
| 2 | 3.5–7.0% | 4.7% | 1.5 |
| 3 | 13.0–19.8% | 16.2% | 3.3 |
| 4 | 25.8–31.2% | 28.3% | 5.5 |
| 5 | 38.6–43.0% | 41.0% | 8.6 |

Concavity is `1 - area / convex hull area`: deeper bays remove more area from
the hull. Every sampled day's five levels increased in concavity; none reversed
the intended progression. The ranges did not overlap across levels.

Also checked that all 225 outlines admit a finite straight cut producing two
connected pieces with a displayed 50.0/50.0 split. A coarse orientation sweep
found 222; a boundary-based area-bisecting chord search found the remaining
three. The latter solves for a half-area chord along each boundary chain, then
validates it with the same finite-cut rules as the game. This matters because
an infinite line through several lobes is not a valid two-piece cut.

Retained the existing generator profiles. They already separate the levels
while retaining minimum edge clearance and rejecting sharp tips. Avoid changing
the random sequence merely to retune a profile that is behaving as intended.

These measurements describe outline complexity, not measured player skill.
Player scores will be needed to calibrate perceived difficulty. Existing saved
sets retain their original controls if generator settings change later.
