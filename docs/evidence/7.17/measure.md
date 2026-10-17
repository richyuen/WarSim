# PLAN 7.17: a smaller save (measures)

The critic's save of seed 3371 at year 27 (`critic/c7_seed3371_y27.bin`, format version 1, 40,010,648 bytes), its sections by size (a script over `decodeSections`):

```
file 40010648 sections 123 data 40007394
cells.econ                   u32     8388608 21.0%
cells.pop                    u32     8388608 21.0%
cells.owner                  u16     4194304 10.5%
cells.controller             u16     4194304 10.5%
cells.province               u16     4194304 10.5%
cells.supply                 u16     4194304 10.5%
cells.terrain                u8      2097152 5.2%
cells.flip                   u8      2097152 5.2%
stats.km2                    f32      724752 1.8%
elements.wound               f64      229792 0.6%
stats.air                    f32      207072 0.5%
history.rows                 f64      186816 0.5%
elements.formation           u32      114896 0.3%
elements.target              u32      114896 0.3%
elements.slot                u16       57448 0.1%
```

The eight per-cell layers are 96 % of it. Runs of equal elements (counted over the same sections): owner 4.9 % of its raw bytes, controller 4.9 %, province 8.4 %, econ 6.8 %, pop 6.6 %, supply 4.1 %, terrain 32.6 %, flip 0.0 %.

## After (format version 2, ADR-484)

The same save loaded and saved again:

```
{
  v1: 40010648,
  v2: 4857416,
  share: '0.121',
  hash: 'b22b82b0',
  hashAfter: 'b22b82b0',
  saveMs: '64',
  loadV1Ms: '21',
  loadV2Ms: '38'
}
3 days on, same: true
```

A 1938 world of seed 99 a month on (`tests/unit/saveRuns.test.ts`): version 1 38,837,928 bytes, version 2 3,416,144 (8.8 %).
