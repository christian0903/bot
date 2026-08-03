import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  )
}
