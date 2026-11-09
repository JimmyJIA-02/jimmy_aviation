// Categories a spotting can be tagged with on the form. Keep the keys in step with the server's SpottingTags.java
export const SPOTTING_TAGS = [
    { key: 'special-livery', label: 'Special livery', icon: '🎨' },
    { key: 'retro-livery', label: 'Retro livery', icon: '🕰' },
    { key: 'alliance-livery', label: 'Alliance livery', icon: '🤝' },
    { key: 'cargo', label: 'Cargo', icon: '📦' },
    { key: 'rare-visitor', label: 'Rare visitor', icon: '⭐' },
    { key: 'delivery', label: 'Delivery / ferry', icon: '🛫' },
    { key: 'diversion', label: 'Diversion', icon: '↪' },
    { key: 'government', label: 'Military / government', icon: '🏛' },
    { key: 'night', label: 'Night shot', icon: '🌙' },
];

export const tagInfo = (key) => SPOTTING_TAGS.find(t => t.key === key);
