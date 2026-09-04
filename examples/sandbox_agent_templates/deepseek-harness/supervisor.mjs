import { spawn } from 'node:child_process'
import { createWriteStream, promises as fs } from 'node:fs'

const RESTART_DELAY_MS = 1000
const dshLog = createWriteStream('/tmp/deepseek-harness/dsh.log', { flags: 'a' })
const gatewayLog = createWriteStream('/tmp/deepseek-harness/gateway.log', { flags: 'a' })
let children = []
let stopping = false

function managedEnv() {
  const env = { ...process.env }
  env.HOME ||= '/home/user'
  env.DSH_HOME ||= `${env.HOME}/.dsh`
  return env
}

async function stopChildren() {
  const current = children
  children = []
  for (const child of current) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  await Promise.all(current.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 3000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })))
}

async function stopOrphanedProcesses() {
  const entries = await fs.readdir('/proc', { withFileTypes: true })
  const matched = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue
    try {
      const cmdline = await fs.readFile(`/proc/${entry.name}/cmdline`, 'utf8')
      if (cmdline.includes('/usr/bin/dsh\0web\0--no-open')
        || cmdline.includes('/opt/deepseek-harness/web-gateway.mjs')) {
        const pid = Number(entry.name)
        if (pid !== process.pid) {
          process.kill(pid, 'SIGTERM')
          matched.push(pid)
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') throw error
    }
  }
  if (!matched.length) return

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const alive = await Promise.all(matched.map(async (pid) => {
      try {
        await fs.access(`/proc/${pid}/cmdline`)
        return true
      } catch (error) {
        return error.code !== 'ENOENT'
      }
    }))
    if (!alive.some(Boolean)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  for (const pid of matched) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
}

function startDsh(env) {
  return new Promise((resolve, reject) => {
    const child = spawn('dsh', ['web', '--no-open'], {
      cwd: '/home/user',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let buffered = ''
    let tokenResolved = false
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('dsh did not publish its browser token within 30 seconds'))
    }, 30_000)

    child.stdout.on('data', (chunk) => {
      buffered += chunk.toString('utf8')
      const match = buffered.match(/dsh web: http:\/\/127\.0\.0\.1:3080\/\?token=([A-Za-z0-9_-]+)/)
      let newline
      while ((newline = buffered.indexOf('\n')) !== -1) {
        const line = buffered.slice(0, newline + 1)
        buffered = buffered.slice(newline + 1)
        dshLog.write(line.replace(/token=[A-Za-z0-9_-]+/g, 'token=<redacted>'))
      }
      if (match && !tokenResolved) {
        tokenResolved = true
        clearTimeout(timeout)
        resolve({ child, token: match[1] })
      } else if (buffered.length > 8192) {
        buffered = buffered.slice(-4096)
      }
    })
    child.stderr.pipe(dshLog, { end: false })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`dsh exited before startup with code ${code}`))
    })
    child.once('error', reject)
  })
}

function waitForStop(child, name) {
  return new Promise((resolve) => {
    let resolved = false
    const stopped = () => {
      if (resolved) return
      resolved = true
      resolve(name)
    }
    child.once('exit', stopped)
    child.once('error', stopped)
    if (child.exitCode !== null) stopped()
  })
}

async function startChildren() {
  await stopChildren()
  await stopOrphanedProcesses()

  const env = managedEnv()
  const { child: dsh, token } = await startDsh(env)
  const gateway = spawn('node', ['/opt/deepseek-harness/web-gateway.mjs'], {
    cwd: '/home/user',
    env: { ...env, DSH_UPSTREAM_TOKEN: token },
    stdio: ['ignore', gatewayLog, gatewayLog],
  })
  children = [dsh, gateway]
  console.log('Managed processes started')
}

async function supervise() {
  while (!stopping) {
    try {
      await startChildren()
      const stoppedName = await Promise.race([
        waitForStop(children[0], 'dsh'),
        waitForStop(children[1], 'gateway'),
      ])
      if (!stopping) console.error(`${stoppedName} stopped; scheduling managed process restart`)
    } catch (error) {
      console.error(`Failed to start managed processes: ${error.message}`)
    }

    if (!stopping) {
      await stopChildren()
      await new Promise((resolve) => setTimeout(resolve, RESTART_DELAY_MS))
    }
  }
}

async function shutdown() {
  if (stopping) return
  stopping = true
  await stopChildren()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

await supervise()
dshLog.end()
gatewayLog.end()
