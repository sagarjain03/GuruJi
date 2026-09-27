import { RoadmapView } from '@/components/roadmap/roadmap-view'

export const metadata = {
  title: 'Roadmap',
  description: 'The topics in order, and how far through each one you are.',
}

/** The curriculum, rendered from `RoadmapNode` rows — never hard-coded here. */
export default function RoadmapPage() {
  return <RoadmapView />
}
