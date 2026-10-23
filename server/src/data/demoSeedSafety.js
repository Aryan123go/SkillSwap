export function validateDemoSeedConfiguration({
  mode,
  nodeEnvironment,
  confirmation,
  mongoUri,
  allowRemote,
  password,
}) {
  if (!['--apply', '--reset'].includes(mode)) {
    throw new Error('Choose exactly one explicit mode: --apply or --reset.')
  }
  if (!['development', 'test'].includes(nodeEnvironment)) {
    throw new Error('Demo data can only be changed when NODE_ENV is development or test.')
  }
  const expectedConfirmation = mode === '--apply' ? 'CREATE_DEMO_DATA' : 'RESET_DEMO_DATA'
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Set DEMO_SEED_CONFIRM=${expectedConfirmation} to confirm this operation.`)
  }
  if (!mongoUri) throw new Error('MONGODB_URI is required.')

  let uri
  try {
    uri = new URL(mongoUri)
  } catch {
    throw new Error('MONGODB_URI is not a valid MongoDB connection URL.')
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)) {
    throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://.')
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  if (!localHosts.has(uri.hostname.toLocaleLowerCase('en')) && allowRemote !== 'true') {
    throw new Error('Remote MongoDB targets require DEMO_SEED_ALLOW_REMOTE=true and a dedicated development database.')
  }

  if (mode === '--apply' && (
    !password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72
  )) {
    throw new Error('Set DEMO_SEED_PASSWORD to a value of 8–72 UTF-8 bytes.')
  }
}
