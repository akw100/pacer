import ChallengesPage from '../features/challenges/ChallengesPage'

// The Challenges tab simply mounts the challenges slice's hub. All behaviour
// (list, create, respond, join, check-in, realtime) lives in features/challenges.
export default function Challenges() {
  return <ChallengesPage />
}
