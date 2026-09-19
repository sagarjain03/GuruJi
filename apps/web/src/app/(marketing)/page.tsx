import Hero from '@/components/Hero'
import Navbar from '@/components/Navbar'

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
      </main>
    </>
  )
}
