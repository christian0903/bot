import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 md:pb-6">
        <Outlet />
      </main>
      {/* La marge qui dégage la barre de navigation mobile vit ici et non sur
          le <main> : le pied de page est en dehors de celui-ci, il passait donc
          SOUS la barre fixe et restait invisible — y compris son lien vers
          l'aide, qu'il fallait deviner en forçant le défilement. */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Footer />
      </div>
      <MobileBottomNav />
    </div>
  )
}
