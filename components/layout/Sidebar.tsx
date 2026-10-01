import { NavPanel } from './NavPanel'

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
      <NavPanel />
    </aside>
  )
}
