import {
  VisualizerInputError,
  type AlgorithmMetrics,
  type AlgorithmOptions,
  type AlgorithmStep,
  type StepType,
  type StructureSnapshot,
  type VariableValue,
} from './model'

export const MAX_STEP_COUNT = 10_000

export interface StepDetail {
  indices?: number[]
  nodeIds?: string[]
  cells?: [number, number][]
  values?: number[]
  variables?: Record<string, VariableValue>
  description: string
}

/**
 * Collects the step stream for one run.
 *
 * Every emitted step gets a deep copy of the snapshot and of the metrics, so a
 * later mutation by the algorithm — or by a careless caller — cannot rewrite a
 * step that was already recorded. That is what makes step-back exact.
 */
export class Recorder {
  readonly steps: AlgorithmStep[] = []
  readonly metrics: AlgorithmMetrics = { comparisons: 0, swaps: 0, visits: 0 }
  private readonly maxSteps: number

  constructor(options: AlgorithmOptions = {}) {
    this.maxSteps = Math.min(options.maxSteps ?? MAX_STEP_COUNT, MAX_STEP_COUNT)
  }

  emit(type: StepType, state: StructureSnapshot, detail: StepDetail): void {
    if (this.steps.length >= this.maxSteps) {
      throw new VisualizerInputError(
        `This input needs more than ${this.maxSteps.toLocaleString('en-US')} steps. Try a smaller input.`,
      )
    }
    this.steps.push({
      type,
      ...(detail.indices === undefined ? {} : { indices: [...detail.indices] }),
      ...(detail.nodeIds === undefined ? {} : { nodeIds: [...detail.nodeIds] }),
      ...(detail.cells === undefined ? {} : { cells: detail.cells.map(([row, column]) => [row, column]) }),
      ...(detail.values === undefined ? {} : { values: [...detail.values] }),
      state: structuredClone(state),
      variables: { ...detail.variables },
      description: detail.description,
      metrics: { ...this.metrics },
    })
  }
}
