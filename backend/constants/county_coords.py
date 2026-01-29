"""Static coordinates for Norwegian counties (Centroids).

These are approximate administrative centers/centroids for map display.
"""

# County code -> (latitude, longitude)
COUNTY_COORDS: dict[str, tuple[float, float]] = {
    "03": (59.9139, 10.7522),  # Oslo
    "11": (58.9700, 5.7331),  # Rogaland (Stavanger area)
    "15": (62.4722, 6.1549),  # Møre og Romsdal (Ålesund area)
    "18": (67.2800, 14.4050),  # Nordland (Bodø area)
    "21": (78.2232, 15.6267),  # Svalbard (Longyearbyen)
    "31": (59.2181, 10.9298),  # Østfold (Fredrikstad area)
    "32": (59.9127, 10.7461),  # Akershus (near Oslo)
    "33": (59.7441, 10.2045),  # Buskerud (Drammen area)
    "34": (61.1153, 10.4662),  # Innlandet (Hamar area)
    "39": (59.2677, 10.4078),  # Vestfold (Tønsberg area)
    "40": (59.2092, 9.6064),  # Telemark (Skien area)
    "42": (58.1599, 8.0182),  # Agder (Kristiansand area)
    "46": (60.3913, 5.3221),  # Vestland (Bergen area)
    "50": (63.4305, 10.3951),  # Trøndelag (Trondheim area)
    "55": (69.6496, 18.9560),  # Troms (Tromsø area)
    "56": (70.6634, 23.6821),  # Finnmark (Hammerfest area)
}
