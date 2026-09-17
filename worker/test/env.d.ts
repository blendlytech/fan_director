declare namespace Cloudflare {
  type WorkerEnv = import('../src/types').Env
  interface Env extends WorkerEnv {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
  }
}
