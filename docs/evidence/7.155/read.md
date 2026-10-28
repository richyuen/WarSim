# PLAN 7.155 — the read: which port and which water each refused sail is for

Method: HEAD `babbff71`, from 1938, every fleet sailing `orderSail` refused for no sea way
(`MoveRejected`, `RejectReason.NoSeaWay`), with the way's origin and target cells recorded at the refusal (a
temporary tap in `sail.ts`, not committed) and its cause read from the sea zones: the origin's or the target's zone
none or closed by ice, a passage shut (a way with no passage shut exists), or no lane joins the two zones. The ports
named are those whose water is the cell (else the nearest port). Zones: 424 Lake Ontario, 421 Lake Superior/Huron,
425 Lake Erie/St Clair, 428 Lake Malawi; 121, 218, 28, 215, 73 the sea's (basin 1, `basinOf`'s ocean).

## Causes

| seed, years | refused | no lane | ice | passage shut |
|---|---|---|---|---|
| 1415 × 1 | 384 | 384 | 0 | 0 |
| 1411 × 3 | 1,428 | 1,428 | 0 | 0 |
| 1413 × 3 | 282 | 282 | 0 | 0 |

## Cases (each refused sail by nation, origin → target)

1415 × 1:

```
CAN from Iqaluit z121 → Toronto z424            88
CAN from Iqaluit z121 → Hamilton z424           88
CAN from Iqaluit z121 → Sault Ste. Marie z421   88
CAN from Iqaluit z121 → Detroit z425            88
ENG from Georgetown z215 → Mzuzu z428           32
```

1411 × 3 (Canada's transports at Iqaluit, then off Belém, then at Ferrol, all asking for the same four lake ports):

```
CAN from Iqaluit z121 → Toronto / Hamilton / Sault Ste. Marie / Detroit          230 each
CAN from near Belém z218 → Toronto / Hamilton / Sault Ste. Marie / Detroit       112 each
CAN from Ferrol z28 → Toronto / Hamilton / Sault Ste. Marie / Detroit             15 each
```

1413 × 3:

```
CAN from Vila Velha z218 → Toronto / Hamilton / Sault Ste. Marie / Detroit        70 each
ENG from Comodoro Rivadavia z73 → Mzuzu z428                                       1
ENG from Georgetown z215 → Mzuzu z428                                              1
```

## The cause

Every refusal is the invasion AI's `sailToArmy` sending transports on the sea for a port of their nation on a lake.
It takes, for each formation of the army, the `SAIL_TRIES` (4) ports of its nation nearest it on its land with water,
whatever that water. Canada's army in Ontario: its four nearest ports with water are Toronto, Hamilton, Detroit and
Sault Ste. Marie, all on the Great Lakes (Montréal and North Bay have none), so every try was refused and no port on
the sea (Halifax, Charlottetown, Sydney, Kuujjuarapik) was ever asked: the transports stood, asking each planning day.
Britain's Mzuzu is on Lake Malawi.

The rule (ADR-752): `sailToArmy` takes only ports whose water is in the waters the transports sail (`waterKeys`, as
`nearestOwnPort` reads them: not a lake, not a zone ice closes, not behind a passage shut to the nation). On 1415 × 2
with it: refused 0 and 0 (HEAD 384 in year 1), landings 81 and 124.
