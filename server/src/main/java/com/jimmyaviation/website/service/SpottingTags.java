package com.jimmyaviation.website.service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The categories a spotting can be tagged with. Keep in step with client/src/utils/spottingTags.js.
 */
public final class SpottingTags {

    public static final Set<String> ALLOWED = Set.of("special-scheme", "cargo", "helicopter", "business-jet");

    private SpottingTags() {}

    /**
     * @param csv tags as the form sends them, e.g. "cargo,special-scheme"; null or blank for none
     * @throws IllegalArgumentException for a tag that isn't in {@link #ALLOWED}
     */
    public static Set<String> parse(String csv) {
        if (csv == null || csv.isBlank()) {
            return new LinkedHashSet<>();
        }
        Set<String> tags = Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(tag -> !tag.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (String tag : tags) {
            if (!ALLOWED.contains(tag)) {
                throw new IllegalArgumentException("Unknown category \"" + tag + "\"");
            }
        }
        return tags;
    }
}
