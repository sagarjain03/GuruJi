import { RoadmapView } from '@/components/roadmap/roadmap-view'

export const metadata = { title: 'Roadmap' }

/** The curriculum, rendered from `RoadmapNode` rows — never hard-coded here. */
export default function RoadmapPage() {
  return <RoadmapView />
}
