// Role-specific hierarchy; normalized safe zones remain fixed within a format.
export const sceneTemplates={
 hook:{heroScale:1.06,textScale:1.05,relationship:'question or arresting single metaphor'},
 problem:{heroScale:1,textScale:1,relationship:'one obstacle with optional cause'},
 comparison:{heroScale:.95,textScale:1,relationship:'focal proposition plus smaller alternatives'},
 steps:{heroScale:.95,textScale:.96,relationship:'focal outcome; supporting steps enter in reading order'},
 stat:{heroScale:.8,textScale:1.05,relationship:'source-provided number with explanatory symbol'},
 cta:{heroScale:1,textScale:1.05,relationship:'one next action; final phrase emphasized'}
} as const;
