# PLAN 7.56: the landing's army and its port, measured; 7.56a the march kept (ADR-596)

2026-10-21, on `2fba39d` (7.54b) and the rule. Tools: `tools/diag/portMarch.ts` (the march days
from each free formation to each port of the nation on that land, the transports' sail days, the
pair `sailToArmy` picks, and the follow to the first sends: `march_8693.json`, `march_1129.json`),
`tools/diag/whoOrders.ts` (which system changes a formation's march target), `tools/diag/cellHolders.ts`
(whose front a sector is), `tools/diag/landingProbe.ts` (`tryLanding`'s answer for the plan's
targets on a nation's invasion days), `tools/diag/followFormation.ts`.

## 1. The measure (7.56's "measured first")

On the first day `sailToArmy` runs (the nearest free formation's march to the transports' port
refused), for each free formation and each port of the nation on that land with water by it:

| case | free formations | ports | the pair `sailToArmy` picks | its sail + march | pairs under 60 days (in series / side by side) |
| --- | --- | --- | --- | --- | --- |
| 8693 y10 Germany (transports at Annaba) | 29 | 20 | id 11 → Antalya | 6.4 + 5.0 days | 218 / 244 of 580 |
| 1129 y20 Britain (transports at Warri) | 7 | 37 | id 335 → Adana | 27.1 + 18.8 days | 20 / 50 of 165 |

The pick is a good one in both: no routing lever is short of it. **Every slow formation is on foot**
(4 km/h, `DRY_SPEED` does not bite a template on foot): 7.56's "about 1.2 cells a day (DRY_SPEED)"
is the desert's move cost for infantry, not the fuel. 335 and its two neighbours stand 31 cells
from Adana; the others of Britain's 104–225 days from any port.

## 2. What happens after the sail (the follow)

- **8693:** the transports stand at Antalya on day 10. That day 183 of Germany's 190 formations on
  the land are on the march (the operational AI's), 7 free; the nearest free 85–107 cells off, in
  desert, 60 days' march (ids 87, 107, 131 sent; 87 still on the march at day 60, not re-ordered).
  The formations of day 1 within 5 days of Antalya (11, 19, 27, 45, …) are all on other marches by
  day 10. No port is nearer any free formation by march (each one's quickest is Antalya, 58–109 days).
- **1129:** the transports stand at Adana on day 30; 335 is sent (18.8 days). On day 35 the
  operational AI re-orders it to 1293,355, 18 steps short (`whoOrders.ts`: `operationalAi`, the
  allotment's orders; its orders had been refused as long ways while it stood, `LongWay` rejects on
  days 28–30). That sector is **Germany's front** (`cellHolders.ts`: 42 German cells, 7 Soviet; Germany
  on Britain's side): an ally's front, which the operational AI mans (PLAN 1.42b) and the invasion
  AI's "far from the front" does not count (PLAN 7.26c3a: its own front only). The next sent, 445 on
  day 37, is re-ordered on day 40. Every week the same.

## 3. 7.56a: the rule

`ai/operational.ts` `planNation`: a formation on the march to a port where a transport group of its
nation stands (not under way, with room; `amphibious.ts` `transportPorts`, `marchingToPort`: its
target within AT_PORT_CELLS of the port's land cell) is not one of the plan's free formations. It
was sent there to go aboard.

- Test: `landingMarchKept1938.test.ts` (Germany at war with Poland, its transports at Kiel, its
  division nearest the front ordered to Kiel, the operational AI run by hand every 6 hours for 4
  days): red without (re-ordered to the front), green with.
- 1129 with the rule: 335 marches on and stands at Adana from day 48 (before: re-ordered on day 35).
  It does not board: see §4. On day 53, standing at the port, it is taken again by the operational AI
  (a formation that stands is not on the march: the rule does not cover it; the invasion AI's day in
  between, 51, is the one that should have loaded it).
- Pin d188faed → 63d0cfd9.

## 4. The second cause (7.56b)

On Britain's invasion day 51 the plan's target is the enemy port nearest the transports by straight
km whose zone is open and not held by an enemy: **Baku** (1,358 km), then Türkmenbaşy (1,620 km), both
on the Caspian. `tryLanding` refuses both with `NoSeaWay` (8): no way over the water from Adana.
Karachi (3,350 km) and Bhavnagar would be taken (0). `planLanding` breaks at the first refusal and
returns, so the army at the port never boards (`landingProbe.ts`). PLAN 7.56b.

## 5. Left

8693: no free formation within 58 days of any port, the near army on the operational AI's marches:
no rule of the landing's routing reaches it (BLOCKERS after 7.56b, the user's).
