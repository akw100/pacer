import { CoachScreen } from '../features/assistant/CoachScreen'

// The Nav slot at /challenges is repurposed in v1 to host Pacer Coach (the
// Assistant chat UI). The route path stays /challenges to keep any existing
// links/bookmarks working; only the label + icon in Nav change.
export default function Challenges() {
  return <CoachScreen />
}
