// Categories a spotting can be tagged with on the form. Keep the keys in step with the server's SpottingTags.java
export const SPOTTING_TAGS = [
    { key: 'special-scheme', label: 'Special scheme', icon: '🎨' },
    { key: 'cargo', label: 'Cargo', icon: '📦' },
    { key: 'helicopter', label: 'Helicopter', icon: '🚁' },
    { key: 'business-jet', label: 'Business jet', icon: '💼' },
];

export const tagInfo = (key) => SPOTTING_TAGS.find(t => t.key === key);
