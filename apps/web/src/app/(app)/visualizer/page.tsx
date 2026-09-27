import { VisualizerView } from '@/components/visualizer/visualizer-view'

export const metadata = {
  title: 'Visualizer',
  description: 'Step through an algorithm one operation at a time, on your own input.',
}

export default function VisualizerPage() {
  return <VisualizerView />
}