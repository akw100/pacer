import { useEffect } from 'react'
import { GroupsPage } from '../features/groups/GroupsPage'
import { useGroupContext } from '../features/groups/GroupContext'

export default function Group() {
  const { setActiveGroupId } = useGroupContext()
  // Leaving the Group page clears the "active" selection so the next FAB open
  // from elsewhere defaults back to "Personal only" (or the user's sticky pick).
  useEffect(() => {
    return () => setActiveGroupId(null)
  }, [setActiveGroupId])
  return <GroupsPage />
}
