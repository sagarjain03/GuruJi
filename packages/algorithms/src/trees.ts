import type { AlgorithmOptions, AlgorithmStep, TreeNode, TreeSnapshot } from './model'
import { Recorder } from './recorder'

/** Builds a tree from LeetCode-style level order: `1, 2, 3, null, 4`. */
export function buildTree(levelOrder: (number | null)[]): TreeSnapshot {
  const nodes: TreeNode[] = []
  const first = levelOrder[0]
  if (first === undefined || first === null) {
    return { kind: 'tree', root: null, nodes, tags: {} }
  }

  const root: TreeNode = { id: 't0', value: first, left: null, right: null }
  nodes.push(root)
  const pending: TreeNode[] = [root]
  let cursor = 1

  while (pending.length > 0 && cursor < levelOrder.length) {
    const parent = pending.shift()
    if (parent === undefined) break
    for (const side of ['left', 'right'] as const) {
      const value = levelOrder[cursor]
      if (value !== undefined && value !== null) {
        const child: TreeNode = { id: `t${cursor}`, value, left: null, right: null }
        parent[side] = child.id
        nodes.push(child)
        pending.push(child)
      }
      cursor += 1
    }
  }
  return { kind: 'tree', root: root.id, nodes, tags: {} }
}

function lookup(state: TreeSnapshot): (id: string) => TreeNode {
  const byId = new Map(state.nodes.map((node) => [node.id, node]))
  return (id) => {
    const found = byId.get(id)
    if (found === undefined) throw new RangeError(`No tree node ${id}.`)
    return found
  }
}

function children(node: TreeNode): string[] {
  return [node.left, node.right].filter((id): id is string => id !== null)
}

function search(kind: 'BFS' | 'DFS', levelOrder: (number | null)[], target: number, options: AlgorithmOptions): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = buildTree(levelOrder)
  const get = lookup(state)
  const frontier: string[] = state.root === null ? [] : [state.root]
  const noun = kind === 'BFS' ? 'queue' : 'stack'
  const shown = (): string => `[${frontier.map((id) => get(id).value).join(', ')}]`
  let foundId: string | null = null

  if (state.root !== null) {
    state.tags[state.root] = 'queued'
    recorder.emit('PUSH', state, {
      nodeIds: [state.root],
      variables: { [noun]: shown(), target },
      description: `Start with the root ${get(state.root).value} on the ${noun}.`,
    })
  }

  while (frontier.length > 0) {
    const id = kind === 'BFS' ? frontier.shift() : frontier.pop()
    if (id === undefined) break
    const current = get(id)
    recorder.metrics.visits += 1
    recorder.metrics.comparisons += 1
    state.tags[id] = 'visited'
    recorder.emit('POP', state, {
      nodeIds: [id],
      variables: { [noun]: shown(), current: current.value, target },
      description: `Take ${current.value} off the ${noun}. Is it ${target}?`,
    })

    if (current.value === target) {
      foundId = id
      state.tags[id] = 'found'
      recorder.emit('MARK', state, {
        nodeIds: [id],
        variables: { [noun]: shown(), current: current.value, target },
        description: `Found ${target}.`,
      })
      break
    }

    // A stack pops the last push first, so push right before left to go left first.
    const next = kind === 'BFS' ? children(current) : children(current).reverse()
    if (next.length === 0) continue
    for (const child of next) {
      frontier.push(child)
      state.tags[child] = 'queued'
    }
    recorder.emit('PUSH', state, {
      nodeIds: next,
      variables: { [noun]: shown(), current: current.value, target },
      description: `Not it. Add its children ${next.map((child) => get(child).value).join(' and ')} to the ${noun}.`,
    })
  }

  recorder.emit('DONE', state, {
    nodeIds: foundId === null ? [] : [foundId],
    variables: { target, found: foundId !== null },
    description: foundId === null ? `${target} is not in the tree.` : `${kind} found ${target}.`,
  })
  return recorder.steps
}

export function treeBfs(levelOrder: (number | null)[], target: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  return search('BFS', levelOrder, target, options)
}

export function treeDfs(levelOrder: (number | null)[], target: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  return search('DFS', levelOrder, target, options)
}

export type DepthFirstOrder = 'inorder' | 'preorder' | 'postorder'

const ORDER_NAME: Record<DepthFirstOrder, string> = {
  preorder: 'Pre-order',
  inorder: 'In-order',
  postorder: 'Post-order',
}

const ORDER_RULE: Record<DepthFirstOrder, string> = {
  preorder: 'node, then left, then right',
  inorder: 'left, then node, then right',
  postorder: 'left, then right, then node',
}

export function traverse(order: DepthFirstOrder, levelOrder: (number | null)[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = buildTree(levelOrder)
  const get = lookup(state)
  const output: number[] = []
  const path: number[] = []
  const variables = () => ({ output: output.join(', '), callStack: path.join(' → ') })

  const emitOutput = (node: TreeNode): void => {
    output.push(node.value)
    state.tags[node.id] = 'settled'
    recorder.emit('MARK', state, {
      nodeIds: [node.id],
      variables: variables(),
      description: `Output ${node.value}.`,
    })
  }

  const walk = (id: string | null): void => {
    if (id === null) return
    const node = get(id)
    path.push(node.value)
    recorder.metrics.visits += 1
    if (state.tags[id] === undefined) state.tags[id] = 'visited'
    recorder.emit('VISIT', state, {
      nodeIds: [id],
      variables: variables(),
      description: `Arrive at ${node.value}. ${ORDER_NAME[order]} is ${ORDER_RULE[order]}.`,
    })
    if (order === 'preorder') emitOutput(node)
    walk(node.left)
    if (order === 'inorder') emitOutput(node)
    walk(node.right)
    if (order === 'postorder') emitOutput(node)
    path.pop()
  }

  walk(state.root)
  recorder.emit('DONE', state, {
    variables: variables(),
    description: `${ORDER_NAME[order]}: ${output.join(', ')}.`,
  })
  return recorder.steps
}

export function levelOrder(levelOrderInput: (number | null)[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = buildTree(levelOrderInput)
  const get = lookup(state)
  const levels: number[][] = []
  let queue: string[] = state.root === null ? [] : [state.root]
  const shown = (): string => levels.map((level) => `[${level.join(', ')}]`).join(' ')

  while (queue.length > 0) {
    const depth = levels.length
    for (const id of queue) state.tags[id] = 'queued'
    recorder.emit('PUSH', state, {
      nodeIds: [...queue],
      variables: { level: depth, width: queue.length, levels: shown() },
      description: `Level ${depth} has ${queue.length} node${queue.length === 1 ? '' : 's'}; process exactly that many.`,
    })

    const current: number[] = []
    levels.push(current)
    const nextQueue: string[] = []
    for (const id of queue) {
      const node = get(id)
      recorder.metrics.visits += 1
      current.push(node.value)
      state.tags[id] = 'settled'
      nextQueue.push(...children(node))
      recorder.emit('POP', state, {
        nodeIds: [id],
        variables: { level: depth, width: queue.length, levels: shown() },
        description: `Output ${node.value} on level ${depth} and queue its children.`,
      })
    }
    queue = nextQueue
  }

  recorder.emit('DONE', state, {
    variables: { levels: shown() },
    description: `Level order: ${shown()}.`,
  })
  return recorder.steps
}
