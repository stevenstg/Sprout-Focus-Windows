import readline from 'node:readline';
import { GUARDIAN_MESSAGES } from '../shared/ipc.js';
import { GuardianRuntime } from './runtime.js';

function emit(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const runtime = new GuardianRuntime({
  send: (message) => emit(message),
  logger: console,
});

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', async (line) => {
  if (!line.trim()) {
    return;
  }

  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    emit({
      type: GUARDIAN_MESSAGES.response,
      requestId: null,
      ok: false,
      error: `非法 JSON: ${error.message}`,
    });
    return;
  }

  try {
    const payload = await runtime.handle(request);
    emit({
      type: GUARDIAN_MESSAGES.response,
      requestId: request.requestId,
      ok: true,
      payload,
    });
  } catch (error) {
    emit({
      type: GUARDIAN_MESSAGES.response,
      requestId: request.requestId,
      ok: false,
      error: error.message,
    });
  }
});

process.on('SIGINT', () => {
  process.exit(0);
});
