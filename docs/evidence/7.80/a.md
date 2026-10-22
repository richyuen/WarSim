# PLAN 7.80a: what shreds the late map (R12-B2), measured

Read on 2026-10-22, the sim code of HEAD unchanged (the pin unchanged). Tool:
`tools/diag/fragKinds.ts` (read only). It counts the map's pieces as the critic did (run 12,
`critic/scripts/c12_frag.ts`): 4-connected runs of land cells of one holder (controller), and of
them the pieces of 2–400 cells ("small pieces" below). Each small piece is put in one kind:

- *occupied*: most of its cells are owned by another nation (an occupation pocket);
- *founded*: its holder is a nation founded in play (`origin` ≠ 0: rebel states, statelets);
- *own*: its holder owns it and is a nation of the scenario;

and it is *coastal* when a cell of it touches water, an *enclave* when its land rim is held by one
other nation alone (water aside), *at war* when its holder is at war with that nation.

## 1. The kinds, on the critic's saves (run 11 on `dd3b730`, run 12 on `896ff779`)

The 24 seeds both runs saved, means a world (`a/kinds_c1{1,2}_y{10,20}.json`). The critic's own
counts are reproduced exactly (year 20: 837 → 1,174).

| | y10 dd3b730 | y10 896ff779 | y20 dd3b730 | y20 896ff779 | y20 up on |
|---|---|---|---|---|---|
| small pieces | 739 | 928 | 837 | 1,174 | 24 of 24 |
| of 2–10 cells | 421 | 518 | 463 | 639 | 24 |
| occupied | 6 | 14 | 5 | 13 | 15 |
| founded | 9 | 27 | 11 | 53 | 24 |
| own | 724 | 887 | 821 | 1,108 | 24 |
| own, coastal | 514 | 570 | 538 | 640 | 24 |
| enclaves | 221 | 292 | 276 | 412 | 23 |
| enclaves at war | 54 | 58 | 47 | 54 | 11 |
| living nations | 82 | 92 | 81 | 95 | 23 |
| living founded | 5.5 | 15.5 | 6.6 | 20.7 | 24 |

So the growth is land a nation owns (+288 of +337 at year 20), inland more than on the coast
(+186 against +102), and much of it in enclaves at peace (229 → 358). Occupation pockets (+8) and
so pockets held on a supplied beach (ADR-630, coastal and occupied: +5) are not the cause.

## 2. The bisection

From 1938 to the end of year 10 (`fragKinds.ts seed:run:5,10`, as `npm run sim` steps, the lane
graph first), at each commit that changed `src/sim`, `src/shared` or the data, 8 seeds. The tool
in a worktree of each commit reproduces the critic's year-10 saves exactly at both ends (1129: 777
and 947; 7019: 669 and 894). Small pieces at year 10 (`a/<commit>_<seed>.log`):

| commit | seeds | 1129 | 7019 | 1307 | 4877 | 2081 | 3613 | 5309 | 9437 | mean | own | founded | occupied |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dd3b730 | critic saves | 777 | 669 | 741 | 708 | 700 | 943 | 603 | 836 | 747 | 733 | 8 | 6 |
| ec1ac280 | 8 runs | 702 | 721 | 754 | 718 | 693 | 794 | 723 | 779 | 736 | 719 | 12 | 4 |
| f3ec0a75 | 8 runs | 727 | 782 | 755 | 613 | 833 | 803 | 696 | 784 | 749 | 734 | 8 | 8 |
| 415254e8 | 8 runs | 840 | 738 | 760 | 743 | 690 | 738 | 723 | 806 | 755 | 738 | 15 | 2 |
| d15131c4 | 8 runs | 848 | 777 | 882 | 788 | 989 | 870 | 905 | 863 | 865 | 827 | 28 | 10 |
| 3f672059 | 8 runs | 732 | 868 | 876 | 766 | 786 | 887 | 719 | 1017 | 831 | 804 | 17 | 10 |
| 7e27d0a4 | 8 runs | 837 | 847 | 960 | 945 | 824 | 802 | 780 | 922 | 865 | 818 | 30 | 16 |
| 896ff779 | critic saves | 947 | 894 | 923 | 810 | 836 | 907 | 967 | 989 | 909 | 867 | 28 | 14 |

The step is `d15131c4`, PLAN 7.65's reserve cut (ADR-615, from the user's ADR-592 a: at war,
under its peacetime share, an army order keeps no reserve of income): 755 → 865, up on 8 of 8
seeds, 110 of the range's 162. Founded pieces 15 → 28 at the same step. The commits before it
(the ferry, ADR-612–614) move nothing beyond the seeds' spread (736–755); those after it 831–909,
within the noise of two 8-seed means (the seeds' spread at `d15131c4` gives one a standard error of
about 25; 865 against 909 is about one standard error of their difference).
None of the candidates the critic named is the step: walk-ins without fronts (PLAN 7.73c,
`1ad0c127`), moving capitals (7.68, `90015d7d`) and beach supply (7.70a `65bd907c`, 7.75
`309f0d4e`) all fall after `7e27d0a4` or between it and HEAD, where the mean moves 865 → 909.

## 3. Shredding per conquest fell

Cells that changed holder, summed by year (the critic's `c1{1,2}_headless_*.json`, `flipped`), on
the same 24 seeds:

| | dd3b730 | 896ff779 |
|---|---|---|
| cells flipped to year 10 | 316,315 | 447,982 (1.42 ×) |
| cells flipped to year 20 | 543,058 | 818,309 (1.51 ×) |
| small pieces per 10,000 flips, year 10 | 23.4 | 20.7 |
| small pieces per 10,000 flips, year 20 | 15.4 | 14.3 |

The map is cut more because more land changes hands (the war that the reserve cut pays for), not
because a change of land leaves more pieces than before. "Make conquest follow fronts" (the
critic's fix) aims at a mechanism that has not grown worse.

## 4. What a rule on enclaves could take back

A treaty hands over land cell by cell: the winner annexes all of the losers' land it occupies
(SPEC §4 terms, ADR-51), so the peace leaves whatever pattern the occupation had. Of year 20's
1,174 small pieces on run 12, 358 are enclaves at peace. With every one of them gone the count
would be 816 a world, under `dd3b730`'s 837, and under it on 15 of the 24 seeds. That is the
ceiling of any enclave rule: a rule at the treaty misses the enclaves born of revolts and deaths
(the founded +42) and those made before the run's last peace.

## 5. The cause and what follows

The cause: ADR-615's reserve cut, the user's (ADR-592 a), through the war it buys. PLAN 7.80's
text sends a user's rule found to be the cause to the user as that rule's price (ADR-639, proposed):
accept the count, or a treaty-time pocket rule (PLAN 7.80b), or take the reserve cut back.
