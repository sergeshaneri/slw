// Known localStorage keys. The trailing `string` keeps this open for
// dynamic per-id keys like `hint_${id}` while documenting the known set.
// Found in src/api/client.js, src/App.jsx, components/Heatmap, etc.
export type LocalStorageKey =
  | 'slw_token'
  | 'slw_dev_admin'
  | 'survey_insight_hint_dismissed'
  | 'welcome_seen'
  | 'slw_intro_seen'
  | 'hint_nav-aspects-cta'
  | 'hint_journey-chat-intro'
  | string
