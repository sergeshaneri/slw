// Top-level view-router state in App.tsx.
// Confirmed by enumerating every literal passed to setView()/handleViewChange()
// in App.jsx. If a new view is added, extend this union and Header's nav-items
// will surface compile errors at any unhandled site.
export type ViewName =
  | 'dashboard'
  | 'aspects'
  | 'journey'
  | 'diary'
  | 'coach'
  | 'hall'
  | 'profile'
  | 'public-profile'
  | 'settings'
  | 'admin'
  | 'leaderboard'
  | 'dm'
  | 'search'
