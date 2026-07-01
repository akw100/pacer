import { CoachScreen } from '../features/assistant/CoachScreen'

// The /coach route simply mounts the Coach chat surface. All behaviour
// (history state, composer, error mapping, suggestion chips) lives in
// features/assistant.
export default function Coach() {
  return <CoachScreen />
}
