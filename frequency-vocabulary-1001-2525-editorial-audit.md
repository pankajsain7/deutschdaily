# Editorial audit: frequency vocabulary 1001–2525

Scope: every remaining frequency card after the 1–1000 audit. The review covers
the German headword and gloss, German example sentence, and English example
translation for grammar, semantic fidelity, and natural English.

## Corrections applied

The ranks below were corrected in both `src/frequency-dictionary-data.js` and
`src/frequency-dictionary.json`.

| Range | Corrected ranks |
| --- | --- |
| 1001–1199 | 1008, 1056, 1092, 1117, 1133, 1167, 1190 |
| 1200–1399 | 1202, 1213, 1215, 1219, 1225, 1248, 1250, 1255, 1262, 1263, 1271, 1275, 1276, 1282, 1307, 1317, 1319, 1334, 1336, 1345, 1362, 1372, 1381, 1390 |
| 1400–1599 | 1418, 1429, 1433, 1455, 1458, 1477, 1478, 1485, 1489, 1497, 1502, 1510, 1514–1516, 1533, 1540, 1542, 1551, 1553, 1558, 1566, 1585–1586, 1596, 1599 |
| 1600–1799 | 1601, 1621, 1627, 1632–1633, 1643, 1663, 1669, 1674–1675, 1687, 1689, 1725, 1729, 1732–1733, 1749, 1760, 1768, 1772, 1780, 1792, 1798 |
| 1800–1999 | 1809, 1812, 1816, 1853, 1868, 1875, 1879, 1882–1883, 1895, 1910, 1934–1935, 1950, 1965, 1975, 1981, 1989, 1991 |
| 2000–2199 | 2002, 2010, 2024, 2049, 2052–2053, 2059, 2087, 2095, 2103, 2112, 2118, 2140, 2142, 2153, 2167, 2177, 2181–2182, 2193 |
| 2200–2399 | 2201, 2225, 2227, 2229, 2234, 2248, 2253, 2260, 2263, 2281–2283, 2290, 2294, 2296, 2310–2311, 2313, 2316, 2326, 2347, 2357, 2361, 2378, 2385–2386, 2389, 2394, 2398 |
| 2400–2525 | 2403, 2407, 2419, 2425, 2434, 2436–2438, 2446, 2452, 2455, 2474, 2497, 2501, 2513, 2521 |

## Main error types resolved

- Restored German tense, modality, and grammatical punctuation: for example,
  1117, 1190, 1202, 1215, 1219, 1271, 1381, 1621, 1632–1633, 1792,
  1950, 1975, 2052, 2296, and 2437.
- Removed English additions or changed meanings: for example, 1202, 1275,
  1390, 1429, 1542, 1566, 1732, 1760, 1809, 1895, 2002, 2053, 2095,
  2140, 2153, 2225, 2394, 2403, and 2455.
- Replaced unnatural English with idiomatic equivalents: for example, 1056,
  1514, 1585, 1599, 1663, 1816, 1935, 1965, 1981, 2142, 2253, 2310,
  2361, 2386, and 2474.
- Removed glosses that incorrectly merged unrelated words or parts of speech:
  1133, 1213, 1248, 1317, 1345, 1362, 1433, 1478, 1515, 1643, 1729,
  1882, 1991, 2059, 2112, and 2419.

## Validation criteria

- The corrected English retains the German sentence’s person, number, tense,
  modality, and level of certainty.
- Glosses prioritize the part of speech and meaning shown in the example.
- German sentences use standard spelling and punctuation; colloquial forms are
  labelled where retained.
- English examples read naturally without adding unsupported information.
