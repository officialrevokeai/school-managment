/** Managed containers expose SERVER_PORT; their proxy cannot reach loopback. */
export function resolveListenConfig(env: NodeJS.ProcessEnv = process.env) {
  const assignedPort = env.SERVER_PORT?.trim();
  const portText = assignedPort || env.PORT?.trim() || '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${assignedPort ? 'SERVER_PORT' : 'PORT'} must be a whole-number TCP port between 1 and 65535.`);
  }
  // The panel allocation wins over an old PORT/HOST copied from .env.example.
  const host = assignedPort ? '0.0.0.0' :
    env.HOST?.trim() || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  return { host, port };
}
