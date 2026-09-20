# Sandbox images

One image per language, each from a **pinned** base tag — never `:latest`, so a
rebuild cannot silently change the toolchain under us.

Build them all:

```bash
pnpm --filter @guruji/code-runner images:build
```

## What is deliberately absent

No package manager, no `curl`, no `wget`, no `git`, and **no shell**. The last
one matters most: nearly every ready-made sandbox-escape and fork-bomb recipe is
written in shell, and an image with no `/bin/sh` cannot run any of them. Every
extra binary is a tool handed to an attacker.

There is also no `USER` line. The runner passes `--user 10001:10001`, a uid that
exists in no `/etc/passwd` in the image, so there is no account to belong to and
nothing that assumes root can work.

## Why compile and run are two containers

`/tmp` is a 16 MB `noexec,nosuid` tmpfs, so a binary written there cannot be
executed — which is the point, and it is also the reason a compiled language
cannot compile and run in one step without either a shell or a writable-exec
`/tmp`. Both would give up a control to save a container start.

Instead the runner creates one work directory per submission on the host:

1. **Compile** — the work directory is mounted read-write at `/sandbox`, the
   entrypoint is the compiler, and it writes `/sandbox/prog`. Compiler stderr is
   the `COMPILE_ERROR` output. Same limits as a run, its own longer timeout.
2. **Run** — the work directory is mounted **read-only**, and the entrypoint is
   `/sandbox/prog`.

Interpreted languages skip step 1 and run `/sandbox/source` directly.

A compiler is a program that reads attacker-controlled input — C++ templates can
consume unbounded time and memory at compile time — so step 1 is sandboxed
exactly as tightly as step 2.
