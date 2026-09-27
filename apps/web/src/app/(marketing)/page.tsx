import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  description:
    'GuruJi measures what you actually understand and decides what you should practise next.',
}

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
      <Footer />
    </>
  )
}
